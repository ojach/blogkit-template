const input = document.querySelector('[data-search]');
const list = document.querySelector('[data-results]');

if (input && list) {
  const pageSize = 15;
  let articles = [];
  let matchingArticles = [];
  let currentPage = 1;
  const originalHtml = list.innerHTML;
  let pagination = null;
  // Keep the build-generated pagination in its original position.
  const originalPagination = [...list.parentElement.querySelectorAll('.pagination')]
    .find((nav) => !list.contains(nav)) || null;
  const paginationAnchor = originalPagination ? document.createComment('original pagination') : null;
  if (originalPagination) originalPagination.before(paginationAnchor);

  const setSearchMode = (active) => {
    if (!originalPagination) return;
    if (active && originalPagination.isConnected) originalPagination.remove();
    if (!active && !originalPagination.isConnected) paginationAnchor.after(originalPagination);
  };

  const addText = (parent, tag, text, className) => {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
  };

  const removePagination = () => {
    pagination?.remove();
    pagination = null;
  };

  const renderPagination = () => {
    removePagination();
    const pageCount = Math.ceil(matchingArticles.length / pageSize);
    if (pageCount <= 1) return;

    pagination = document.createElement('nav');
    pagination.className = 'pagination';
    pagination.setAttribute('aria-label', 'Search result pages');

    // Use the same link markup as build.js so existing pagination CSS applies.
    const previous = document.createElement('a');
    previous.href = '#';
    previous.textContent = '← 前の15件';
    if (currentPage > 1) {
      previous.addEventListener('click', (event) => {
        event.preventDefault();
        currentPage -= 1;
        renderResults();
      });
    }

    const status = document.createElement('span');
    status.setAttribute('aria-live', 'polite');
    status.textContent = `${currentPage} / ${pageCount}`;

    const next = document.createElement('a');
    next.href = '#';
    next.textContent = '次の15件 →';
    if (currentPage < pageCount) {
      next.addEventListener('click', (event) => {
        event.preventDefault();
        currentPage += 1;
        renderResults();
      });
    }

    if (currentPage > 1) pagination.append(previous);
    pagination.append(status);
    if (currentPage < pageCount) pagination.append(next);
    if (paginationAnchor) paginationAnchor.before(pagination);
    else list.after(pagination);
  };

  const renderResults = () => {
    list.replaceChildren();
    const pageArticles = matchingArticles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    for (const article of pageArticles) {
      const item = document.createElement('li');
      item.className = 'article-card';
      item.dataset.card = '';
      if (article.thumbnail) {
        item.classList.add('has-thumbnail');
        const image = document.createElement('img');
        image.className = 'card-thumbnail';
        image.src = article.thumbnail;
        image.alt = '';
        image.loading = 'lazy';
        item.append(image);
      }

      const copy = document.createElement('div');
      copy.className = 'card-copy';
      const meta = [article.displayDate || article.published, article.category].filter(Boolean).join(' · ');
      addText(copy, 'div', meta, 'article-meta');
      const heading = document.createElement('h2');
      const link = document.createElement('a');
      link.href = article.url;
      link.textContent = article.title;
      heading.append(link);
      copy.append(heading);
      addText(copy, 'p', article.excerpt || article.description || '');
      item.append(copy);
      list.append(item);
    }

    renderPagination();
  };

  fetch(input.dataset.indexUrl || 'search-index.json')
    .then((response) => {
      if (!response.ok) throw new Error('Search index unavailable');
      return response.json();
    })
    .then((data) => { articles = data; })
    .catch(() => {});

  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase();
    if (!query) {
      removePagination();
      setSearchMode(false);
      list.innerHTML = originalHtml;
      return;
    }

    setSearchMode(true);
    matchingArticles = articles.filter((article) =>
      [article.title, article.description, article.category]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    );
    currentPage = 1;

    if (!matchingArticles.length) {
      removePagination();
      list.replaceChildren();
      addText(list, 'li', input.dataset.noResults || 'No matching articles.', 'empty');
      return;
    }

    renderResults();
  });
}
