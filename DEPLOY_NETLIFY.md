# Netlify Deployment Instructions for LeadFlow India CRM

1. Ensure your project root contains:
   - index.html
   - code.gs (for reference, not deployed)
   - summary.md (optional)
   - netlify.toml
   - _redirects

2. Deploying to Netlify:
   - Go to https://app.netlify.com/ and log in.
   - Click "Add new site" > "Import an existing project".
   - Connect your GitHub repo (syntaxFool/lms_v9).
   - Set the publish directory to "." (the root).
   - No build command is needed (static site).
   - Deploy the site.

3. For SPA Routing:
   - The _redirects file ensures all routes serve index.html.

4. After Deploying:
   - Visit your Netlify site URL to verify the app loads.
   - Update your Google Apps Script URL in the app settings if needed.

# For any dynamic backend, use Netlify Functions or external APIs.
