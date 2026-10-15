/*
  Embed "Follow the money to your campus" in another page with automatic height.

  Paste this where the tool should appear (replace YOUR-USERNAME):

    <div id="campus-money"></div>
    <script src="https://YOUR-USERNAME.github.io/campus-midterm-money/embed.js"></script>

  Optional: link straight to one school by adding data-school, e.g.
    <div id="campus-money" data-school="usc"></div>
*/
(function () {
  var script = document.currentScript;
  var base = script.src.replace(/embed\.js(\?.*)?$/, "");
  var host = document.getElementById("campus-money");
  if (!host) {
    host = document.createElement("div");
    script.parentNode.insertBefore(host, script);
  }
  var school = host.getAttribute("data-school");
  var frame = document.createElement("iframe");
  frame.src = base + (school ? "#/school/" + encodeURIComponent(school) : "");
  frame.title = "Follow the money to your campus";
  frame.loading = "lazy";
  frame.style.cssText = "width:100%;border:0;display:block;min-height:900px;";
  frame.setAttribute("scrolling", "no");
  host.appendChild(frame);
  var origin = new URL(base).origin;
  window.addEventListener("message", function (ev) {
    if (ev.origin !== origin || !ev.data) return;
    if (ev.data.type === "campus-money:height") {
      frame.style.height = ev.data.height + "px";
      frame.style.minHeight = "0";
    } else if (ev.data.type === "campus-money:navigate") {
      var top = frame.getBoundingClientRect().top;
      if (top < 0) window.scrollBy(0, top - 16);
    }
  });
})();
