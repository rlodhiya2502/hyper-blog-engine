# Hyper Blog Engine

Welcome to the Hyper Blog Engine! This is a high-performance, production-ready blog platform with a strong focus on speed, SEO, and a modern user experience. The entire system is driven by Markdown files and operates without a database.

## Core Philosophy

- **Static-First**: The engine works as a Static Site Generator (SSG). A build script pre-renders the entire blog into static HTML files for incredibly fast load times.
- **Zero Database**: All content, metadata, and SEO settings are stored in simple Markdown files.
- **Fully Automated**: A file watcher monitors the content directory. Adding, deleting, or changing a Markdown file automatically triggers a rebuild of the static site during development.
- **Modern UX**: The frontend is mobile-first and responsive, featuring skeleton loaders, infinite scroll, and a client-side search.
- **SEO-Driven**: Each post's Markdown file has a detailed "frontmatter" section to control every aspect of its on-page SEO.

---

## How to Get Started

### 1. Installation

First, you need to install the project dependencies defined in `package.json`. Open your terminal, navigate to the project root, and run:

```bash
npm install