document.addEventListener("DOMContentLoaded", () => {
  const summary = document.querySelector("#bookingSummary");
  if (!summary) return;

  const removeVatWording = () => {
    summary.querySelectorAll("div").forEach((row) => {
      row.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.includes(" including VAT")) {
          node.textContent = node.textContent.replaceAll(" including VAT", "");
        }
      });
    });
  };

  removeVatWording();
  new MutationObserver(removeVatWording).observe(summary, {
    childList: true,
    subtree: true,
    characterData: true
  });
});
