// paperease - app.js
// this file handles everything - searching for papers, showing them on screen
// and calling the AI to explain them in plain english

// grab all the elements we need from the page
const searchBox = document.getElementById('searchBox');
const searchBtn = document.getElementById('searchBtn');
const errorText = document.getElementById('errorText');
const loadingSpinner = document.getElementById('loadingSpinner');
const paperList = document.getElementById('paperList');
const filterBar = document.getElementById('filterBar');
const yearFrom = document.getElementById('yearFrom');
const sortBy = document.getElementById('sortBy');
const paperCount = document.getElementById('paperCount');

// modal elements
const summaryModal = document.getElementById('summaryModal');
const closeModal = document.getElementById('closeModal');
const modalPaperTitle = document.getElementById('modalPaperTitle');
const modalTag = document.getElementById('modalTag');
const modalSummaryText = document.getElementById('modalSummaryText');

// store results so we can filter without searching again
let fetchedPapers = [];

// search when button clicked or enter pressed
searchBtn.addEventListener('click', handleSearch);
searchBox.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') handleSearch();
});

// re-render when user changes filters
yearFrom.addEventListener('input', renderFilteredPapers);
sortBy.addEventListener('change', renderFilteredPapers);

closeModal.addEventListener('click', function () {
  summaryModal.classList.add('hidden');
});

// also close if user clicks the dark background
summaryModal.addEventListener('click', function (e) {
  if (e.target === summaryModal) summaryModal.classList.add('hidden');
});

async function handleSearch() {
  const query = searchBox.value.trim();

  if (!query) {
    errorText.textContent = 'Please enter a search topic.';
    return;
  }

  errorText.textContent = '';
  loadingSpinner.classList.remove('hidden');
  paperList.innerHTML = '';
  fetchedPapers = [];

  try {
    // was getting CORS errors calling semantic scholar directly from browser
    // nginx proxies /papers to the API instead
    const url =
      '/papers' +
      '?query=' +
      encodeURIComponent(query) +
      '&limit=20' +
      '&fields=title,authors,year,citationCount,abstract,externalIds,openAccessPdf';

    const res = await fetch(url);
    if (!res.ok) throw new Error('Search failed, try again.');

    const json = await res.json();
    fetchedPapers = json.data || [];

    if (fetchedPapers.length === 0) {
      errorText.textContent = 'No papers found. Try different keywords.';
      loadingSpinner.classList.add('hidden');
      return;
    }

    loadingSpinner.classList.add('hidden');
    filterBar.classList.remove('hidden');
    renderFilteredPapers();
  } catch (err) {
    loadingSpinner.classList.add('hidden');
    errorText.textContent = 'Something went wrong: ' + err.message;
  }
}

function renderFilteredPapers() {
  // copy the array so we don't mess up the original
  let papers = fetchedPapers.slice();

  const minYear = parseInt(yearFrom.value);
  if (!isNaN(minYear) && minYear > 1900) {
    papers = papers.filter(function (p) {
      return p.year && p.year >= minYear;
    });
  }

  const sort = sortBy.value;
  if (sort === 'newest') {
    papers.sort(function (a, b) {
      return (b.year || 0) - (a.year || 0);
    });
  } else if (sort === 'oldest') {
    papers.sort(function (a, b) {
      return (a.year || 0) - (b.year || 0);
    });
  } else if (sort === 'citations') {
    papers.sort(function (a, b) {
      return (b.citationCount || 0) - (a.citationCount || 0);
    });
  }

  paperCount.textContent =
    'Showing ' + papers.length + ' of ' + fetchedPapers.length + ' papers';

  paperList.innerHTML = '';
  papers.forEach(function (paper, i) {
    paperList.appendChild(buildPaperCard(paper, i));
  });
}

function buildPaperCard(paper, index) {
  const card = document.createElement('div');
  card.className = 'paper-card';

  const title = paper.title || 'Untitled';
  const year = paper.year || 'N/A';
  const citations = paper.citationCount || 0;

  // only show first 3 authors to keep it clean
  const authorList = (paper.authors || [])
    .slice(0, 3)
    .map(function (a) {
      return a.name;
    })
    .join(', ');

  const abstract = paper.abstract
    ? paper.abstract.slice(0, 300) + '...'
    : 'No abstract available.';

  // try to get a direct link to the paper
  let link = '#';
  if (paper.openAccessPdf && paper.openAccessPdf.url) {
    link = paper.openAccessPdf.url;
  } else if (paper.externalIds && paper.externalIds.DOI) {
    link = 'https://doi.org/' + paper.externalIds.DOI;
  }

  const safeTitle = escapeAttr(paper.title || '');
  const safeAbstract = escapeAttr(paper.abstract || '');

  card.innerHTML =
    '<h2 class="paper-title"><a href="' +
    link +
    '" target="_blank">' +
    title +
    '</a></h2>' +
    '<p class="paper-meta">' +
    (authorList ? authorList + ' · ' : '') +
    year +
    '</p>' +
    '<p class="paper-abstract">' +
    abstract +
    '</p>' +
    '<div class="card-footer">' +
    '<span class="tag">' +
    year +
    '</span>' +
    '<span class="tag">' +
    citations.toLocaleString() +
    ' citations</span>' +
    '<button class="explain-btn" onclick="getSummary(this, \'' +
    safeTitle +
    "', '" +
    safeAbstract +
    '\')">Explain this paper</button>' +
    '</div>';
  return card;
}

async function getSummary(btn, title, abstract) {
  if (!abstract) {
    openModal(title, 'Note', 'No abstract available for this paper.');
    return;
  }

  btn.textContent = 'Loading...';
  btn.disabled = true;

  // prompt tells the AI exactly how we want the summary structured
  const prompt =
    'You are helping a university student understand a research paper.\n\n' +
    'Title: "' +
    title +
    '"\n' +
    'Abstract: "' +
    abstract +
    '"\n\n' +
    'Explain in plain English using this structure:\n\n' +
    'What is this paper about?\n' +
    'What problem does it solve?\n' +
    'What did they do?\n' +
    'What did they find?\n' +
    'Why does it matter?\n\n' +
    'No jargon. Write for a student reading their first research paper.';

  try {
    // moved to proxy - nginx forwards /summarise to groq with the API key
    // this way the key never ends up in the browser
    const res = await fetch('/summarise', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // llama3-8b-8192 was deprecated, switching to the newer model
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error?.message || 'Request failed');
    }

    const data = await res.json();
    openModal(title, 'Plain English Summary', data.choices[0].message.content);
  } catch (err) {
    openModal(title, 'Error', 'Could not generate summary: ' + err.message);
  }

  btn.textContent = 'Explain this paper';
  btn.disabled = false;
}

function openModal(title, tag, text) {
  modalPaperTitle.textContent = title;
  modalTag.textContent = tag;
  modalSummaryText.textContent = text;
  summaryModal.classList.remove('hidden');
}

// basic escaping so titles and abstracts don't break the onclick attribute
function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
}
