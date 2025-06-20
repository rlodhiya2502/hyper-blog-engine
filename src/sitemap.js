/*
 * Server-side Sitemap Validator and Submitter
 *
 * This Node.js script creates a simple web server with one job:
 * to validate a sitemap.xml file and submit it to search engines.
 *
 * How to use:
 * 1. Run this script with Node.js.
 * 2. Send a POST request to: http://localhost:4000/submit-sitemap
 * 3. The body of the request should be JSON, like this:
 * { "sitemapUrl": "https://www.yourwebsite.co.uk/sitemap.xml" }
 */

// Import necessary libraries
const express = require('express'); // A popular framework for building web servers in Node.js
const axios = require('axios');     // For making web requests (e.g., to fetch the sitemap)
const { XMLParser, XMLValidator } = require('fast-xml-parser'); // For checking and reading the XML file

// --- Configuration ---

const PORT = 4000; // The port our server will listen on. You can change this if you need to.

// A list of search engines to ping. The [SITEMAP_URL] part will be replaced
// with your actual sitemap's address.
const SEARCH_ENGINE_DIRECTORIES = [
    {
        name: 'Google',
        pingUrl: 'https://www.google.com/ping?sitemap=[SITEMAP_URL]',
    },
    {
        name: 'Bing',
        pingUrl: 'https://www.bing.com/ping?sitemap=[SITEMAP_URL]',
    },
    // Note: Submitting to Google and Bing covers most search engines,
    // including Yahoo and DuckDuckGo, which use their indexes.
];

// --- Main Application ---

const app = express();

// Use Express's built-in middleware to automatically parse incoming JSON data.
app.use(express.json());

/**
 * A helper function to check if the sitemap's structure is correct.
 * A valid sitemap must have a <urlset> containing at least one <url>,
 * and each <url> must have a <loc> tag.
 *
 * @param {object} sitemapObject - The sitemap file parsed into a JavaScript object.
 * @returns {{isValid: boolean, message: string}} - An object indicating if the structure is valid.
 */
function validateSitemapStructure(sitemapObject) {
    if (!sitemapObject.urlset) {
        return { isValid: false, message: 'Validation failed: The sitemap is missing the root <urlset> tag.' };
    }
    if (!sitemapObject.urlset.url) {
        return { isValid: false, message: 'Validation failed: The sitemap does not contain any <url> tags inside <urlset>.' };
    }

    // The parser handles one or many <url> tags differently.
    // We'll turn a single <url> object into an array to handle both cases the same way.
    const urls = Array.isArray(sitemapObject.urlset.url) ? sitemapObject.urlset.url : [sitemapObject.urlset.url];

    for (const urlEntry of urls) {
        if (!urlEntry.loc) {
            return { isValid: false, message: 'Validation failed: Found a <url> entry that is missing its <loc> tag.' };
        }
    }

    return { isValid: true, message: 'Sitemap structure is valid.' };
}

// Define the main API endpoint for our widget.
app.post('/submit-sitemap', async (req, res) => {
    // Get the sitemap URL from the incoming request body.
    const { sitemapUrl } = req.body;

    if (!sitemapUrl) {
        return res.status(400).json({
            success: false,
            message: 'Error: Please provide a "sitemapUrl" in your request.',
        });
    }

    console.log(`Processing sitemap: ${sitemapUrl}`);

    // --- Step 1: Fetch and Validate the Sitemap ---
    let sitemapText;
    try {
        const response = await axios.get(sitemapUrl, { timeout: 7000 }); // Fetch the file
        sitemapText = response.data;
    } catch (error) {
        console.error(`Error fetching sitemap: ${error.message}`);
        return res.status(400).json({
            success: false,
            message: `Could not fetch the sitemap from the provided URL. Please check the address is correct.`,
            error: error.message,
        });
    }

    // Check if the fetched text is valid XML.
    const isXmlWellFormed = XMLValidator.validate(sitemapText);
    if (isXmlWellFormed !== true) {
        console.error(`XML validation error: ${isXmlWellFormed.err.msg}`);
        return res.status(400).json({
            success: false,
            message: 'The fetched file is not a valid XML document.',
            validationResult: isXmlWellFormed.err,
        });
    }

    // Parse the XML into a JavaScript object and check its structure.
    const parser = new XMLParser();
    const sitemapObject = parser.parse(sitemapText);
    const structureCheck = validateSitemapStructure(sitemapObject);

    if (!structureCheck.isValid) {
        console.error(`Sitemap structure error: ${structureCheck.message}`);
        return res.status(400).json({
            success: false,
            message: structureCheck.message,
        });
    }

    console.log('Sitemap validation successful.');

    // --- Step 2: Submit to Search Engines ---
    const submissionResults = [];
    const encodedSitemapUrl = encodeURIComponent(sitemapUrl); // Ensure the URL is safe for web requests.

    // Use Promise.all to send all pings at the same time for efficiency.
    await Promise.all(
        SEARCH_ENGINE_DIRECTORIES.map(async (engine) => {
            const submissionUrl = engine.pingUrl.replace('[SITEMAP_URL]', encodedSitemapUrl);
            try {
                const pingResponse = await axios.get(submissionUrl, { timeout: 7000 });
                if (pingResponse.status === 200) {
                    console.log(`Successfully submitted to ${engine.name}.`);
                    submissionResults.push({ name: engine.name, success: true, message: 'Submitted successfully.' });
                } else {
                    console.warn(`Submission to ${engine.name} returned status: ${pingResponse.status}`);
                    submissionResults.push({ name: engine.name, success: false, message: `Request returned status code ${pingResponse.status}.` });
                }
            } catch (error) {
                console.error(`Error submitting to ${engine.name}: ${error.message}`);
                submissionResults.push({ name: engine.name, success: false, message: `An error occurred: ${error.message}` });
            }
        })
    );

    // --- Step 3: Send the Final Report ---
    res.status(200).json({
        success: true,
        message: 'Sitemap processing complete.',
        validation: 'Sitemap is valid.',
        submissionReport: submissionResults,
    });
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Sitemap widget server is running on http://localhost:${PORT}`);
    console.log('Waiting for POST requests to /submit-sitemap');
});
