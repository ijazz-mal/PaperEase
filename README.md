# PaperEase

A web app that fetches real academic papers and explains them in plain English using AI. Built for students who want to understand research without wading through dense academic language.

## Demonstration Video

https://youtube.com/shorts/-vKnFUyDVvo?si=lZ23LT0b10Vw-MBm

## Live Demo

https://paperease.maljazz.tech/

## What it does

- Search for any academic topic and get up to 20 real papers from Semantic Scholar
- Filter results by year and sort by relevance, date, or citation count
- Click "Explain this paper" to get a plain English summary powered by Groq (Llama 3)
- Results and summaries are cached so repeat searches don't hit the API again

## APIs used

- **Semantic Scholar** - fetches real academic papers, free to use
  - Docs: https://api.semanticscholar.org/api-docs/
- **Groq (Llama 3)** - generates plain English summaries, free tier available
  - Docs: https://console.groq.com/docs

## How to run locally

Since this is a web app it can be accessed directly at https://paperease.maljazz.tech/

To run locally, clone the repo and open `index.html` in a browser:

```bash
git clone https://github.com/YOUR_USERNAME/PaperEase.git
cd PaperEase
# open index.html in your browser
```

Note: AI summaries require the Nginx proxy setup described in the deployment section below. Paper search works without it.

## Project structure

```
PaperEase/
├── index.html              ← page structure
├── style.css               ← all styling
├── app.js                  ← all logic and API calls
├── nginx_webserver.conf    ← Nginx config for web servers
├── nginx_loadbalancer.conf ← Nginx config for load balancer
└── README.md
```

## Deployment

### Architecture

```
User → Load Balancer (Lb01) → Web01 or Web02
                                    ↓
                           Nginx proxies /papers → Semantic Scholar
                           Nginx proxies /summarise → Groq API
```

### Requirements

- Two Ubuntu web servers with Nginx 1.26+
- One load balancer server with Nginx

### Step 1 - upload files to both web servers

```bash
scp index.html style.css app.js nginx_webserver.conf ubuntu@WEB01_IP:/home/ubuntu/
scp index.html style.css app.js nginx_webserver.conf ubuntu@WEB02_IP:/home/ubuntu/
```

### Step 2 - configure Nginx on Web01 and Web02

```bash
# move app files to web root
sudo mv /home/ubuntu/index.html /var/www/html/
sudo mv /home/ubuntu/style.css /var/www/html/
sudo mv /home/ubuntu/app.js /var/www/html/

# put nginx config in place
sudo cp /home/ubuntu/nginx_webserver.conf /etc/nginx/conf.d/default.conf

# add your API keys to the config
sudo nano /etc/nginx/conf.d/default.conf
# replace SEMANTIC_SCHOLAR_KEY and GROQ_KEY_HERE with your actual keys

# test and restart
sudo nginx -t
sudo systemctl restart nginx
```

### Step 3 - configure the load balancer

```bash
# upload the load balancer config
scp nginx_loadbalancer.conf ubuntu@LB01_IP:/home/ubuntu/

# ssh into the load balancer
ssh ubuntu@LB01_IP

# replace WEB01_IP and WEB02_IP with your actual server IPs
sudo nano /home/ubuntu/nginx_loadbalancer.conf

# put it in place
sudo cp /home/ubuntu/nginx_loadbalancer.conf /etc/nginx/conf.d/default.conf

sudo nginx -t
sudo systemctl restart nginx
```

### Step 4 - verify load balancing is working

```bash
# run on each web server while refreshing the load balancer URL
sudo tail -f /var/log/nginx/access.log
```

You should see requests appearing on both servers confirming traffic is being distributed.

## Security

- API keys are stored in the Nginx config on the server only, never in the browser or source code
- Input validation rejects queries over 200 characters or containing HTML tags
- All paper data is sanitized before being rendered in the DOM to prevent XSS

## Challenges

- **CORS errors** - browsers block direct API calls to external APIs. Fixed by setting up Nginx as a reverse proxy on both web servers so requests go server → API instead of browser → API.
- **IPv6 issues** - the server couldn't reach the Anthropic API over IPv6. Switched to Groq which didn't have this issue.
- **Rate limiting** - Semantic Scholar rate limited the server IP during testing. Fixed by applying for a free API key which gives higher limits.
- **Deprecated model** - the initial Groq model (llama3-8b-8192) was decommissioned mid-development. Updated to llama-3.3-70b-versatile.
- **Nginx version** - the default Ubuntu Nginx (1.18) didn't support proxy_ssl_name. Updated to 1.28 from the official Nginx repo.

## Credits

- [Semantic Scholar API](https://api.semanticscholar.org/) by Allen Institute for AI
- [Groq](https://groq.com) for free LLM inference (Llama 3)
- [Google Fonts](https://fonts.google.com) - Playfair Display and Source Sans 3
