const input = document.querySelector('[data-search]');
const list = document.querySelector('[data-results]');

if (input && list) {
  const pageSize = 15;
  let articles = [];
  let matchingArticles = [];
  let currentPage = 1;
  const originalHtml = list.innerHTML;
  let pagination = null;

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

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.textContent = '← 前の15件';
    previous.disabled = currentPage === 1;
    previous.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderResults();
      }
    });

    const status = document.createElement('span');
    status.setAttribute('aria-live', 'polite');
    status.textContent = `${currentPage} / ${pageCount}`;

    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = '次の15件 →';
    next.disabled = currentPage === pageCount;
    next.addEventListener('click', () => {
      if (currentPage < pageCount) {
        currentPage += 1;
        renderResults();
      }
    });

    pagination.append(previous, status, next);
    list.after(pagination);
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
      list.innerHTML = originalHtml;
      return;
    }

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
