// This script handles all client-side interactivity for the blog.

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Initialisation: Hide skeleton loaders and show content ---
    const skeletonLoader = document.querySelector('.skeleton-loader');
    const contentWrapper = document.querySelector('.content-wrapper');
    if (skeletonLoader && contentWrapper) {
        skeletonLoader.style.display = 'none';
        contentWrapper.classList.remove('is-loading');
        contentWrapper.style.display = 'block'; // Make content visible
    }

    // --- 2. Lazy Loading for Images ---
    const lazyImages = document.querySelectorAll('img.lazy');
    if ('IntersectionObserver' in window) {
        const lazyImageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const lazyImage = entry.target;
                    lazyImage.src = lazyImage.dataset.src;
                    lazyImage.classList.remove('lazy');
                    lazyImageObserver.unobserve(lazyImage);
                }
            });
        });

        lazyImages.forEach(lazyImage => {
            lazyImageObserver.observe(lazyImage);
        });
    } else {
        // Fallback for older browsers
        lazyImages.forEach(lazyImage => {
            lazyImage.src = lazyImage.dataset.src;
        });
    }

    // --- 3. Client-Side Search ---
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');
    let searchIndex = [];

    if (searchInput) {
        // Fetch the search index only when the user focuses on the input
        searchInput.addEventListener('focus', async () => {
            if (searchIndex.length === 0) {
                try {
                    const response = await fetch('/search-index.json');
                    searchIndex = await response.json();
                } catch (error) {
                    console.error('Failed to load search index:', error);
                }
            }
        });

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            if (searchTerm.length < 2) {
                searchResultsContainer.innerHTML = '';
                return;
            }

            const results = searchIndex.filter(post =>
                post.title.toLowerCase().includes(searchTerm) ||
                post.excerpt.toLowerCase().includes(searchTerm)
            );

            displaySearchResults(results);
        });
    }

    function displaySearchResults(results) {
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<p>No results found.</p>';
        } else {
            searchResultsContainer.innerHTML = results
                .map(post => `<a href="/posts/${post.slug}.html">${post.title}</a>`)
                .join('');
        }
    }


    // --- 4. Infinite Scroll for Home Page ---
    const postsContainer = document.getElementById('posts-container');
    const sentinel = document.getElementById('sentinel');
    const postsPerPage = 10;
    let postsToShow = postsPerPage;

    if (postsContainer && sentinel) {
        const allPostCards = Array.from(postsContainer.querySelectorAll('.post-card'));

        // Initially hide all but the first `postsPerPage` cards
        allPostCards.forEach((card, index) => {
            if (index >= postsPerPage) {
                card.classList.add('hidden');
            }
        });

        const infiniteScrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadMorePosts(allPostCards);
            }
        });

        infiniteScrollObserver.observe(sentinel);
    }

    function loadMorePosts(allPostCards) {
        const nextPosts = allPostCards.slice(postsToShow, postsToShow + postsPerPage);
        nextPosts.forEach(card => card.classList.remove('hidden'));
        postsToShow += postsPerPage;

        // If all posts are shown, stop observing
        if (postsToShow >= allPostCards.length) {
            sentinel.style.display = 'none'; // Hide the sentinel
        }
    }
});