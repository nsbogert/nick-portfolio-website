// Keep same-page navigation meaningful to keyboard and screen-reader users.
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', () => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
});
