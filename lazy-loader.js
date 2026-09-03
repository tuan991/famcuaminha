// lazy-loader.js
class LazyLoader {
  constructor() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          this.loadElement(el);
        }
      });
    }, { rootMargin: '100px' });
  }

  loadElement(el) {
    if (el.dataset.src) {
      el.src = el.dataset.src;
      el.removeAttribute('data-src');
    }
    if (el.dataset.component) {
      import(`/components/${el.dataset.component}.js`)
        .then(module => {
          const instance = new module.default();
          el.innerHTML = instance.render();
          if (instance.initEvents) instance.initEvents();
        });
    }
    this.observer.unobserve(el);
  }

  observe() {
    document.querySelectorAll('[data-src], [data-component]').forEach(el => {
      this.observer.observe(el);
    });
  }
}