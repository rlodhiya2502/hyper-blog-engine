// A simple, dependency-free script to build our static blog.
const fs = require('fs-extra');
const path = require('path');
const fm = require('front-matter');
const marked = require('marked');

// Define paths for our project structure.
const contentDir = path.join(__dirname, '..', 'content');
const publicDir = path.join(__dirname, '..', 'public');
const templatesDir = path.join(__dirname, '..', 'templates');
const postsDir = path.join(publicDir, 'posts');
const assetsDir = path.join(__dirname, '..', 'assets');

// --- Helper Functions ---

/**
 * Replaces placeholders in a template string with provided data.
 * e.g., replacePlaceholder(template, '{{TITLE}}', 'My Title')
 * @param {string} template The template string.
 * @param {string} placeholder The placeholder to replace (e.g., {{TITLE}}).
 * @param {string} value The value to insert.
 * @returns {string} The template with the placeholder replaced.
 */
const replacePlaceholder = (template, placeholder, value) => {
    // Use a global regex to replace all instances of the placeholder.
    return template.replace(new RegExp(placeholder, 'g'), value);
};

/**
 * Finds related posts based on shared keywords.
 * @param {object} currentPost The post to find related articles for.
 * @param {Array<object>} allPosts An array of all post objects.
 * @param {number} count The number of related posts to return.
 * @returns {Array<object>} An array of related post objects.
 */
const findRelatedPosts = (currentPost, allPosts, count = 3) => {
    return allPosts
        .filter(post => {
            // A post is not related to itself.
            if (post.attributes.slug === currentPost.attributes.slug) {
                return false;
            }
            // Check if any keyword in the current post is present in the other post's keywords.
            return currentPost.attributes.keywords.some(keyword => post.attributes.keywords.includes(keyword));
        })
        .slice(0, count); // Return only the specified number of related posts.
};


// --- Main Build Function ---

async function build() {
    try {
        console.log('🚀 Starting build process...');

        // 1. Clean: Ensure the /public directory is fresh.
        await fs.emptyDir(publicDir);
        console.log('✅ Cleaned public directory.');

        // 2. Read All Posts: Get content from the /content directory.
        const files = await fs.readdir(contentDir);
        const allPosts = [];

        for (const file of files) {
            if (path.extname(file) === '.md') {
                const data = await fs.readFile(path.join(contentDir, file), 'utf-8');
                const content = fm(data); // Parse frontmatter and markdown body.
                allPosts.push(content);
            }
        }

        // Sort posts by date, newest first.
        allPosts.sort((a, b) => new Date(b.attributes.date) - new Date(a.attributes.date));
        console.log(`✅ Found and parsed ${allPosts.length} posts.`);

        // 3. Generate Search Index: Create a JSON file for client-side search.
        const searchIndex = allPosts.map(post => ({
            title: post.attributes.title,
            slug: post.attributes.slug,
            excerpt: post.attributes.excerpt,
        }));
        await fs.outputJson(path.join(publicDir, 'search-index.json'), searchIndex);
        console.log('✅ Generated search-index.json.');

        // 4. Generate Individual Post Pages
        await fs.ensureDir(postsDir);
        const postTemplate = await fs.readFile(path.join(templatesDir, 'post.html'), 'utf-8');
        const postCardTemplate = await fs.readFile(path.join(templatesDir, 'post-card.html'), 'utf-8');
        const layoutTemplate = await fs.readFile(path.join(templatesDir, 'layout.html'), 'utf-8');

        for (const post of allPosts) {
            const { attributes, body } = post;

            // Find related posts.
            const relatedPosts = findRelatedPosts(post, allPosts);
            let relatedPostsHtml = '';
            if (relatedPosts.length > 0) {
                relatedPosts.forEach(related => {
                    let card = replacePlaceholder(postCardTemplate, '{{POST_URL}}', `/posts/${related.attributes.slug}.html`);
                    card = replacePlaceholder(card, '{{POST_IMAGE}}', related.attributes.coverImage);
                    card = replacePlaceholder(card, '{{POST_TITLE}}', related.attributes.title);
                    card = replacePlaceholder(card, '{{POST_EXCERPT}}', related.attributes.excerpt);
                    relatedPostsHtml += card;
                });
            } else {
                relatedPostsHtml = '<p>No related posts found.</p>';
            }

            // Generate Open Graph tags.
            const ogTags = `
                <meta property="og:title" content="${attributes.og.title}" />
                <meta property="og:description" content="${attributes.og.description}" />
                <meta property="og:image" content="${attributes.og.image}" />
                <meta property="og:type" content="${attributes.og.type}" />
                <meta property="og:url" content="/posts/${attributes.slug}.html" />
            `;

            // Populate the post template.
            let postHtml = replacePlaceholder(postTemplate, '{{POST_TITLE}}', attributes.title);
            postHtml = replacePlaceholder(postHtml, '{{POST_AUTHOR}}', attributes.author);
            postHtml = replacePlaceholder(postHtml, '{{POST_DATE}}', new Date(attributes.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }));
            postHtml = replacePlaceholder(postHtml, '{{POST_COVER_IMAGE}}', attributes.coverImage);
            postHtml = replacePlaceholder(postHtml, '{{POST_CONTENT}}', marked.parse(body));
            postHtml = replacePlaceholder(postHtml, '{{RELATED_POSTS}}', relatedPostsHtml);
            postHtml = replacePlaceholder(postHtml, '{{CTA_TEXT}}', attributes.cta.text);
            postHtml = replacePlaceholder(postHtml, '{{CTA_URL}}', attributes.cta.url);

            // Wrap the post in the main layout.
            let finalHtml = replacePlaceholder(layoutTemplate, '{{CONTENT}}', postHtml);
            finalHtml = replacePlaceholder(finalHtml, '{{PAGE_TITLE}}', attributes.title);
            finalHtml = replacePlaceholder(finalHtml, '{{META_DESCRIPTION}}', attributes.excerpt);
            finalHtml = replacePlaceholder(finalHtml, '{{META_KEYWORDS}}', attributes.keywords.join(', '));
            finalHtml = replacePlaceholder(finalHtml, '{{OG_TAGS}}', ogTags);

            // Save the final HTML file.
            await fs.writeFile(path.join(postsDir, `${attributes.slug}.html`), finalHtml);
        }
        console.log('✅ Generated all post pages.');

        // 5. Generate Home Page (index.html)
        let allPostCardsHtml = '';
        allPosts.forEach(post => {
            let cardHtml = replacePlaceholder(postCardTemplate, '{{POST_URL}}', `/posts/${post.attributes.slug}.html`);
            cardHtml = replacePlaceholder(cardHtml, '{{POST_IMAGE}}', post.attributes.coverImage);
            cardHtml = replacePlaceholder(cardHtml, '{{POST_TITLE}}', post.attributes.title);
            cardHtml = replacePlaceholder(cardHtml, '{{POST_EXCERPT}}', post.attributes.excerpt);
            allPostCardsHtml += cardHtml;
        });

        // The home page content is a grid of all post cards.
        const homePageContent = `
            <header class="home-header">
                <div class="logo-container">
                    <img src="/images/bykes_uk_logo.png" alt="Bykes UK Logo" class="logo" />
                </div>  
                <h1>Hyper Blog Engine</h1>
                <p>A modern, fast, and SEO-friendly blog.</p>
                 <div class="search-container">
                    <input type="search" id="search-input" placeholder="Search for posts..." />
                    <div id="search-results"></div>
                </div>
            </header>
            <div id="posts-container" class="posts-grid">${allPostCardsHtml}</div>
            <div id="sentinel"></div> `;

        const defaultOgTags = `
            <meta property="og:title" content="Hyper Blog Engine - Home" />
            <meta property="og:description" content="A high-performance blog engine." />
            <meta property="og:image" content="/images/bykes_uk_blog_open_graph_image.png" />
            <meta property="og:type" content="website" />
            <meta property="og:url" content="/" />
        `;

        const homepageFooterContent = `
            <footer class="home-footer">
                <p>&copy; ${new Date().getFullYear()} Bykes UK. All rights reserved.</p>
                <p>Powered by <a href="https://www.raminfosystems.co.uk" target="_blank">Raminfo Systems</a>.</p>
            </footer>
                 `;
        

        // Wrap the home page content in the main layout.
        let finalIndexHtml = replacePlaceholder(layoutTemplate, '{{CONTENT}}', homePageContent);
        finalIndexHtml = replacePlaceholder(finalIndexHtml, '{{PAGE_TITLE}}', 'Hyper Blog Engine - Home');
        finalIndexHtml = replacePlaceholder(finalIndexHtml, '{{META_DESCRIPTION}}', 'A high-performance blog engine.');
        finalIndexHtml = replacePlaceholder(finalIndexHtml, '{{META_KEYWORDS}}', 'blog, web development, seo, performance');
        finalIndexHtml = replacePlaceholder(finalIndexHtml, '{{OG_TAGS}}', defaultOgTags);
        finalIndexHtml = replacePlaceholder(finalIndexHtml, '{{FOOTER_CONTENT}}', homepageFooterContent);
        
        await fs.writeFile(path.join(publicDir, 'index.html'), finalIndexHtml);
        console.log('✅ Generated home page (index.html).');

        // 6. Copy Static Assets (CSS, JS)
        // Note: For this project, CSS and JS are placed directly in /public,
        // but this shows how you'd copy from a source folder if you had one.
        //await fs.copy(path.join(__dirname, '..', 'assets'), publicDir);
        await fs.copy(assetsDir, publicDir);
        console.log('✅ Copied static assets.');

        // 7. Generate robots.txt
        const robotsContent = 'User-agent: *\nDisallow: /posts/\nAllow: /';
        await fs.writeFile(path.join(publicDir, 'robots.txt'), robotsContent);  
        console.log('✅ Generated robots.txt.');

        // 8. Generate sitemap.xml
        const sitemapEntries = allPosts.map(post => {
            return `<url>
                <loc>https://${yourDomain}/posts/${post.attributes.slug}.html</loc>
                <lastmod>${new Date(post.attributes.date).toISOString()}</lastmod>
                <changefreq>monthly</changefreq>
                <priority>0.8</priority>
            </url>`;
        }).join('\n');
        const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapEntries}
        </urlset>`;
        await fs.writeFile(path.join(publicDir, 'sitemap.xml'), sitemapContent);
        console.log('✅ Generated sitemap.xml.');

        // 9. Submit sitemap to search engines
        // Note: This is a placeholder. Actual submission requires API calls to search engines.
        console.log('🔍 Remember to submit your sitemap to search engines like Google and Bing.');

        console.log('🎉 Build complete! Your site is ready in the /public directory.');

    } catch (error) {
        console.error('❌ An error occurred during the build process:', error);
    }
}

// Export the build function so it can be used by server.js
module.exports = { build };

// Allow running the build script directly from the command line.
if (require.main === module) {
    build();
}

        await fs.writeFile(path.join(publicDir, 'rss.xml'), rssContent);
        console.log('✅ Generated RSS feed (rss.xml).');

        console.log('🎉 Build complete! Your site is ready in the /public directory.');

    } catch (error) {
        console.error('❌ An error occurred during the build process:', error);
    }
}

// Export the build function so it can be used by server.js
module.exports = { build };

// Allow running the build script directly from the command line.
if (require.main === module) {
    build();
}