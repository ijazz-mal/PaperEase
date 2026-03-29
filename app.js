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

async function handleSearch() {
  const query = searchBox.value.trim();

  if (!query) {
    errorText.textContent = 'Please enter a search topic.';
    return;
  }

  errorText.textContent = '';
  loadingSpinner.style.display = 'block';
  paperList.innerHTML = '';
  fetchedPapers = [];

  try {
    // semantic scholar gives us free access to millions of papers
    const url =
      'https://api.semanticscholar.org/graph/v1/paper/search' +
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
      loadingSpinner.style.display = 'none';
      return;
    }

    loadingSpinner.style.display = 'none';
    filterBar.style.display = 'flex';
    renderFilteredPapers();
  } catch (err) {
    loadingSpinner.style.display = 'none';
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
    '<button class="explain-btn">Explain this paper</button>' +
    '</div>';

  return card;
}
