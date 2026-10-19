/* Follow the money to your campus — front end (no build step, no libraries). */
(function () {
  "use strict";

  var DATA = null;
  var main = document.getElementById("main");
  var footer = document.getElementById("footer");

  /* ------------------------------------------------------------ helpers */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n, exact) {
    n = Number(n) || 0;
    var neg = n < 0; n = Math.abs(n);
    var s;
    if (!exact && n >= 1e6) s = "$" + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + "M";
    else if (!exact && n >= 1e5) s = "$" + Math.round(n / 1e3) + "K";
    else s = "$" + Math.round(n).toLocaleString("en-US");
    return (neg ? "-" : "") + s;
  }
  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function districtName(d) { return "California’s " + ordinal(d) + " District"; }
  function longDate(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    var m = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."][+p[1] - 1];
    return m + " " + (+p[2]) + ", " + p[0];
  }
  var KEEP_UPPER = { LLC: 1, LLP: 1, LP: 1, PC: 1, PLLC: 1, PAC: 1, USA: 1, US: 1, UC: 1, UCLA: 1, USC: 1, UCSF: 1, UCSD: 1,
    SEIU: 1, IBEW: 1, AFSCME: 1, AFL: 1, CIO: 1, AAJ: 1, CEO: 1, JPL: 1, NASA: 1, LA: 1, SF: 1, DC: 1, II: 1, III: 1, IV: 1,
    CA: 1, NA: 1, KPMG: 1, PWC: 1, UFW: 1, CNA: 1, CTA: 1, CFT: 1, UAW: 1, IBM: 1, BNSF: 1, CSU: 1, SDSU: 1, SJSU: 1,
    AIPAC: 1, DMFI: 1, NRA: 1, NEA: 1, AFT: 1, HMP: 1, CLF: 1, NRCC: 1, DCCC: 1, NRSC: 1, DSCC: 1, ATT: 1,
    CPA: 1, VP: 1, SVP: 1, EVP: 1, CFO: 1, COO: 1, CTO: 1, CIO: 1, CMO: 1, RN: 1, MD: 1, DDS: 1, PHD: 1, IHS: 1, HR: 1,
    IT: 1, LAUSD: 1, BRG: 1, BCG: 1, KKR: 1, UBS: 1, JP: 1, GOP: 1, DBA: 1, NAACP: 1, ACLU: 1, CSULB: 1, UCI: 1 };
  var TITLE_ONLY = { ST: 1, MT: 1, JR: 1, SR: 1, DR: 1, MR: 1, MRS: 1, MS: 1, FT: 1 };
  var LOWER = { OF: 1, AND: 1, THE: 1, FOR: 1, AT: 1, IN: 1, ON: 1, TO: 1, A: 1, AN: 1 };
  function titleCase(s) {
    if (!s) return "";
    var words = String(s).trim().split(/\s+/);
    return words.map(function (w, i) {
      return w.split(/([-\/])/).map(function (part) {
        var bare = part.replace(/[^A-Za-z&']/g, "").toUpperCase();
        if (!bare) return part;
        if (TITLE_ONLY[bare]) return bare.charAt(0) + bare.slice(1).toLowerCase() + part.replace(/[A-Za-z&']/g, "");
        if (KEEP_UPPER[bare] || /&/.test(part) || !/[AEIOUY]/.test(bare)) return part.toUpperCase();
        if (i > 0 && LOWER[bare]) return part.toLowerCase();
        var t = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        t = t.replace(/^(Mc)([a-z])/, function (m, a, b) { return a + b.toUpperCase(); })
             .replace(/^(O')([a-z])/, function (m, a, b) { return a + b.toUpperCase(); });
        return t;
      }).join("");
    }).join(" ");
  }
  function personName(fec) {
    if (!fec) return "";
    var bits = String(fec).split(",");
    var last = bits.shift();
    var rest = bits.join(" ").replace(/\b(MR|MRS|MS|DR|HON|REV)\.?(\s|$)/gi, " ");
    var suffix = "";
    rest = rest.replace(/\b(JR|SR|II|III|IV)\.?(?=\s|$)/i, function (m, x) { suffix = x; return " "; }).trim();
    last = last.replace(/\s+(JR|SR|II|III|IV)\.?$/i, function (m, x) { suffix = x; return ""; });
    var out = titleCase((rest ? rest + " " : "") + last);
    if (suffix) out += " " + (/^(JR|SR)$/i.test(suffix) ? titleCase(suffix) + "." : suffix.toUpperCase());
    return out;
  }
  var NO_EMPLOYER = /^(RETIRED|NOT EMPLOYED|NONE|N\/?A|SELF|SELF[- ]EMPLOYED|UNEMPLOYED|HOMEMAKER|STUDENT|INFORMATION REQUESTED.*|REQUESTED)$/i;
  function partyShort(p) { return { DEM: "D", REP: "R", NPP: "No party preference" }[p] || p; }
  function partyLong(p) { return { DEM: "Democrat", REP: "Republican", NPP: "No party preference" }[p] || p; }
  function status(c) {
    var s = (c.status || "").toLowerCase();
    return s === "incumbent" ? "incumbent" : "";
  }
  function candLabel(c) {
    var bits = [partyShort(c.party)];
    if (status(c)) bits.push(status(c));
    return esc(c.name) + " (" + esc(bits.join(", ")) + ")";
  }
  function campusById(id) {
    for (var i = 0; i < DATA.campuses.length; i++) if (DATA.campuses[i].id === id) return DATA.campuses[i];
    return null;
  }
  function campusesIn(d) {
    return DATA.campuses.filter(function (c) { return c.district === d; });
  }
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }

  /* ------------------------------------------------------------ embed */
  function postHeight() {
    if (window.parent === window) return;
    var h = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: "campus-money:height", height: h }, "*");
  }
  if ("ResizeObserver" in window) new ResizeObserver(postHeight).observe(document.body);
  window.addEventListener("load", postHeight);

  /* ------------------------------------------------------------ search */
  function searchIndex() {
    return DATA.campuses.map(function (c) {
      return { c: c, keys: [c.name].concat(c.aliases || []).map(norm), city: norm(c.city) };
    });
  }
  function score(entry, q) {
    var best = 0;
    entry.keys.forEach(function (k) {
      if (k === q) best = Math.max(best, 100);
      else if (k.indexOf(q) === 0) best = Math.max(best, 80);
      else if ((" " + k).indexOf(" " + q) >= 0) best = Math.max(best, 60);
      else if (q.length >= 3 && k.indexOf(q) >= 0) best = Math.max(best, 40);
    });
    // A matching city counts, but less than the school's own name.
    if (entry.city && (entry.city === q || entry.city.indexOf(q) === 0)) best = Math.max(best, 30);
    return best;
  }
  var DISTRICT_Q = /^(?:ca|cd|california)?\s*(?:district|dist)?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*district)?$/;
  function wireSearch(root) {
    var input = root.querySelector("input");
    var list = root.querySelector(".results");
    var idx = searchIndex();
    var cands = Object.keys(DATA.candidates).map(function (id) {
      var c = DATA.candidates[id];
      return { c: c, keys: [norm(c.name)].concat(norm(c.name).split(" ")) };
    });
    var items = [], active = -1;

    function render() {
      var q = norm(input.value);
      if (!q) { list.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
      items = [];
      var dm = q.match(DISTRICT_Q);
      if (dm && DATA.races[+dm[1]]) items.push({ kind: "district", d: +dm[1] });
      idx.map(function (e) { return { e: e, s: score(e, q) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s || (b.e.c.featured - a.e.c.featured) || a.e.c.name.localeCompare(b.e.c.name); })
        .slice(0, 8).forEach(function (x) { items.push({ kind: "school", c: x.e.c }); });
      if (q.length >= 3) {
        cands.map(function (e) { return { e: e, s: score(e, q) }; })
          .filter(function (x) { return x.s >= 60; })
          .sort(function (a, b) { return b.s - a.s || a.e.c.name.localeCompare(b.e.c.name); })
          .slice(0, 4).forEach(function (x) { items.push({ kind: "candidate", c: x.e.c }); });
      }
      items = items.slice(0, 10);
      active = items.length ? 0 : -1;
      if (!items.length) {
        list.innerHTML = '<li class="r-none" role="option" aria-disabled="true">No match. Try a school\u2019s full name, a district number like 37, or a candidate\u2019s last name.</li>';
      } else {
        list.innerHTML = items.map(function (it, i) {
          var name, meta;
          if (it.kind === "school") { name = it.c.name; meta = it.c.system === "Community college" ? "Community college, " + it.c.city : it.c.city; }
          else if (it.kind === "district") { name = districtName(it.d); meta = "District"; }
          else { name = it.c.name; meta = "Candidate, " + ordinal(it.c.district) + " District"; }
          return '<li role="option" id="opt-' + i + '" data-i="' + i + '" aria-selected="' + (i === active) + '">' +
            '<span class="r-name">' + esc(name) + '</span><span class="r-meta">' + esc(meta) + '</span></li>';
        }).join("");
      }
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-activedescendant", active >= 0 ? "opt-" + active : "");
    }
    function highlight(i) {
      active = i;
      Array.prototype.forEach.call(list.querySelectorAll("li[data-i]"), function (li, j) {
        li.setAttribute("aria-selected", String(j === i));
        if (j === i) li.scrollIntoView({ block: "nearest" });
      });
      input.setAttribute("aria-activedescendant", "opt-" + i);
    }
    function go(it) {
      location.hash = it.kind === "school" ? "#/school/" + it.c.id
        : "#/district/" + (it.kind === "district" ? it.d : it.c.district);
    }

    input.addEventListener("input", render);
    input.addEventListener("keydown", function (ev) {
      if (list.hidden || !items.length) return;
      if (ev.key === "ArrowDown") { ev.preventDefault(); highlight(Math.min(items.length - 1, active + 1)); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); highlight(Math.max(0, active - 1)); }
      else if (ev.key === "Escape") { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
    });
    // Pressing Enter (or "Go" on a phone keyboard) opens the highlighted match,
    // or the best match if the suggestion list isn't showing.
    root.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (list.hidden || active < 0) render();
      if (items.length) go(items[active >= 0 ? active : 0]);
      else input.focus();
    });
    list.addEventListener("mousedown", function (ev) {
      var li = ev.target.closest("li[data-i]");
      if (li) { ev.preventDefault(); go(items[+li.getAttribute("data-i")]); }
    });
    input.addEventListener("blur", function () { setTimeout(function () { list.hidden = true; }, 120); });
  }

  /* ------------------------------------------------------------ home */
  function renderHome() {
    document.title = "Follow the money to your campus";
    var groups = [["Private universities", "Private"], ["Cal State (CSU) campuses", "CSU"], ["University of California (UC) campuses", "UC"],
      ["Community colleges", "Community college"]];
    var browse = groups.map(function (g) {
      var list = DATA.campuses.filter(function (c) { return c.featured && c.system === g[1]; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
      return '<section><h2>' + esc(g[0]) + '</h2><ul>' + list.map(function (c) {
        return '<li><a href="#/school/' + esc(c.id) + '"><span class="b-name">' + esc(c.name) + '</span>' +
          '<span class="b-d">' + ordinal(c.district) + ' District</span></a></li>';
      }).join("") + '</ul>' +
      (g[1] === "Community college" ? '<p class="b-more">These are the state\u2019s largest community colleges, each with more than 20,000 students. Use the search bar to find any of California\u2019s 115 community college campuses.</p>' : '') +
      '</section>';
    }).join("");

    main.innerHTML =
      '<div class="ask">' +
        '<h1 class="ask-label">Follow the money to your campus</h1>' +
        '<p class="ask-sub">In the search bar below, type the name of your university, then press ENTER. You\u2019ll be brought to a page that shows what congressional district your university is in, who the candidates running in this election are and what money is being spent on them.</p>' +
        '<form class="search" role="search" autocomplete="off">' +
          '<label class="visually-hidden" for="q">Name of your university</label>' +
          '<input id="q" type="text" role="combobox" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="Type your school, like UCLA or Santa Monica College" aria-autocomplete="list" aria-controls="results" aria-expanded="false">' +
          '<ul class="results" id="results" role="listbox" aria-label="Matching schools and districts" hidden></ul>' +
        '</form>' +
      '</div>' +
      '<nav class="browse" aria-label="Browse campuses">' + browse + '</nav>' +
      districtGrid() +
      racesSection();
    wireSearch(main.querySelector(".search"));
    wireRaceSort();
  }

  function districtGrid() {
    var ds = Object.keys(DATA.races).map(Number).sort(function (a, b) { return a - b; });
    return '<section class="section"><h2>Not at one of these schools?</h2>' +
      '<p class="dek">Every one of California\u2019s 52 congressional districts is here. Pick yours by number.</p>' +
      '<ul class="district-grid">' + ds.map(function (d) {
        return '<li><a href="#/district/' + d + '" aria-label="' + esc(districtName(d)) + '">' + d + '</a></li>';
      }).join("") + '</ul></section>';
  }

  var raceSort = { key: "district", dir: 1 };
  function racesSection() {
    return '<section class="section" id="races"><h2>All 52 California House races</h2>' +
      '<p class="dek">Campaign money is what the candidates raised. Outside money is what independent groups, such as super PACs, spent to support or oppose them. Select a column to sort.</p>' +
      '<div class="table-wrap"><table id="race-table"></table></div></section>';
  }
  function renderRaceTable() {
    var t = document.getElementById("race-table");
    if (!t) return;
    var rows = Object.keys(DATA.races).map(function (k) { return DATA.races[k]; });
    var val = {
      district: function (r) { return r.district; },
      campaign: function (r) { return r.campaignTotal; },
      outside: function (r) { return r.outsideTotal; }
    };
    rows.sort(function (a, b) { return (val[raceSort.key](a) - val[raceSort.key](b)) * raceSort.dir; });
    function th(key, label, cls) {
      var s = raceSort.key === key ? (raceSort.dir < 0 ? "descending" : "ascending") : null;
      return '<th scope="col" class="' + (cls || "") + '"' + (s ? ' aria-sort="' + s + '"' : "") + '><button type="button" data-k="' + key + '"' + (s ? ' aria-sort="' + s + '"' : "") + '>' + label + '</button></th>';
    }
    t.innerHTML = '<thead><tr>' + th("district", "District") + '<th scope="col">Matchup</th><th scope="col">Campuses</th>' +
      th("campaign", "Campaign money", "num") + th("outside", "Outside money", "num") + '</tr></thead><tbody>' +
      rows.map(function (r) {
        var cs = r.candidates.map(function (id) { return DATA.candidates[id]; });
        var camps = DATA.campuses.filter(function (c) { return c.featured && c.district === r.district; });
        var maybe = DATA.campuses.filter(function (c) { return c.featured && c.confidence === "split" && c.alt === r.district; });
        var links = camps.map(function (c) { return '<a href="#/school/' + c.id + '">' + esc(c.name) + '</a>'; })
          .concat(maybe.map(function (c) { return '<a href="#/school/' + c.id + '">' + esc(c.name) + '</a> <span class="none">(part of campus)</span>'; }));
        return '<tr><td><a href="#/district/' + r.district + '">' + ordinal(r.district) + '</a></td>' +
          '<td>' + cs.map(candLabel).join(" vs. ") + '</td>' +
          '<td class="camp-list">' + (links.length ? links.join(", ") : '<span class="none" aria-label="None">\u2014</span>') + '</td>' +
          '<td class="num">' + money(r.campaignTotal) + '</td><td class="num">' + money(r.outsideTotal) + '</td></tr>';
      }).join("") + '</tbody>';
  }
  function wireRaceSort() {
    renderRaceTable();
    var t = document.getElementById("race-table");
    t.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-k]");
      if (!b) return;
      var k = b.getAttribute("data-k");
      raceSort = { key: k, dir: raceSort.key === k ? -raceSort.dir : (k === "district" ? 1 : -1) };
      renderRaceTable();
      var nb = t.querySelector('button[data-k="' + k + '"]');
      if (nb) nb.focus();
    });
  }

  /* ------------------------------------------------------------ race page */
  var PARTS = [
    ["itemized", "Individuals giving over $200", "--c-itemized"],
    ["small", "Individuals giving $200 or less", "--c-small"],
    ["pac", "PACs and other committees", "--c-pac"],
    ["party", "Party committees", "--c-party"],
    ["self", "Candidate’s own money", "--c-self"],
    ["transfers", "Transfers from joint fundraising", "--c-other"],
    ["other", "Other receipts", "--c-other"]
  ];

  // The FEC posts each report's totals before it finishes processing the individual
  // donations in it, so donor-level figures can run behind the totals.
  function donorsLag(c) {
    return c.donorsThrough && c.through && c.donorsThrough < c.through ? c.donorsThrough : "";
  }
  function lagNote(c) {
    var d = donorsLag(c);
    return d ? '<p class="lag">Named donors and the California share cover donations through ' + esc(longDate(d)) +
      '. The FEC hasn\u2019t finished processing the donor details from later reports.</p>' : "";
  }

  function moneyColumn(c, maxRaised) {
    var widthPct = maxRaised > 0 ? Math.max(2, (c.raised / maxRaised) * 100) : 0;
    var segs = PARTS.filter(function (p) { return c.parts[p[0]] > 0; });
    var stack = c.raised > 0
      ? '<div class="stack" style="width:' + widthPct.toFixed(1) + '%" role="img" aria-label="Breakdown of ' + esc(money(c.raised)) + ' raised">' +
          segs.map(function (p) { return '<span style="width:' + (c.parts[p[0]] / c.raised * 100).toFixed(2) + '%;background:var(' + p[2] + ')"></span>'; }).join("") +
        '</div>' +
        '<ul class="legend">' + segs.map(function (p) {
          return '<li><span class="sw" style="background:var(' + p[2] + ')"></span><span>' + p[1] + '</span><span class="amt">' + money(c.parts[p[0]]) + '</span></li>';
        }).join("") + '</ul>'
      : '<p class="none" style="margin-top:1rem">No fundraising reported to the FEC. Candidates must file once they raise or spend $5,000.</p>';
    var facts = c.raised > 0
      ? '<dl class="facts">' +
          '<div><dt>Cash on hand</dt><dd>' + money(c.cash) + '</dd></div>' +
          '<div><dt>Named donors (over $200)</dt><dd>' + c.itemizedDonors.toLocaleString("en-US") + '</dd></div>' +
          '<div><dt>Share of named-donor money from California</dt><dd>' + (c.inState == null ? "—" : Math.round(c.inState * 100) + "%") + '</dd></div>' +
        '</dl>' + lagNote(c)
      : "";
    return '<div class="col">' +
      '<h3 class="cand-name">' + esc(c.name) + '</h3>' +
      '<p class="cand-meta">' + esc(partyLong(c.party)) + (status(c) ? ", incumbent" : "") + '</p>' +
      '<div class="big"><div class="val">' + money(c.raised) + '</div><div class="lab">raised' + (c.through ? " through " + esc(longDate(c.through)) : "") + '</div></div>' +
      stack + facts + '</div>';
  }

  function outsideColumn(c, maxOut) {
    function row(label, amt, color) {
      var w = maxOut > 0 ? (amt / maxOut * 100) : 0;
      return '<div class="ob-row"><span>' + label + '</span><span class="ob-bar"><span style="width:' + w.toFixed(1) + '%;background:var(' + color + ')"></span></span><span class="amt">' + money(amt) + '</span></div>';
    }
    return '<div class="col"><p class="col-label">' + esc(c.name) + ' <span class="p">(' + esc(partyShort(c.party)) + ')</span></p>' +
      '<div class="ob">' + row("Supporting", c.outside.support, "--c-support") + row("Opposing", c.outside.oppose, "--c-oppose") + '</div></div>';
  }

  var TABS = [
    ["topCommittees", "Top PACs and committees"],
    ["topIndividuals", "Top individual donors"],
    ["topEmployers", "Where donors work"],
    ["outsideGroups", "Outside groups"]
  ];
  function listFor(c, key) {
    var arr = c[key] || [];
    if (!arr.length) {
      var empty = { topIndividuals: "No named individual donors reported.", topCommittees: "No PAC or committee donations reported.",
        topEmployers: "No employer information reported.", outsideGroups: "No outside spending reported for or against this candidate." }[key];
      return '<p class="none">' + empty + '</p>';
    }
    return '<ol class="list">' + arr.map(function (x) {
      var who, sub, amt = '<span class="amt">' + money(x.a, true) + '</span>';
      if (key === "topIndividuals") {
        who = personName(x.n);
        var occ = x.o && !/CONDUIT/i.test(x.o) ? titleCase(x.o) : "";
        var emp = x.e && !NO_EMPLOYER.test(x.e.trim()) && x.e.trim().toUpperCase() !== (x.o || "").trim().toUpperCase() ? titleCase(x.e) : "";
        var job = occ && emp ? occ + " at " + emp : (occ || emp);
        sub = [job, titleCase(x.c)].filter(Boolean).join(", ");
      } else if (key === "topCommittees") {
        who = titleCase(x.n);
        sub = x.t;
      } else if (key === "topEmployers") {
        who = titleCase(x.n);
        sub = x.d + (x.d === 1 ? " donor" : " donors");
      } else {
        who = titleCase(x.n);
        sub = x.s === "support" ? '<span class="tag-s">Supporting</span>' : x.s === "oppose" ? '<span class="tag-o">Opposing</span>' : "Position not reported";
        return '<li><span class="who">' + esc(who) + '</span>' + amt + '<span class="sub">' + sub + '</span></li>';
      }
      return '<li><span class="who">' + esc(who) + '</span>' + amt + (sub ? '<span class="sub">' + esc(sub) + '</span>' : "") + '</li>';
    }).join("") + '</ol>';
  }

  function renderRace(d, campus) {
    var race = DATA.races[d];
    if (!race) { renderNotFound(); return; }
    var cs = race.candidates.map(function (id) { return DATA.candidates[id]; });
    var maxRaised = Math.max.apply(null, cs.map(function (c) { return c.raised; }));
    var maxOut = Math.max.apply(null, cs.map(function (c) { return Math.max(c.outside.support, c.outside.oppose); }));
    // Bars use at least a $250,000 scale so token amounts (a $10 web endorsement) don't fill the bar.
    var outScale = Math.max(maxOut, 250000);
    var title = campus ? campus.name + " is in " + districtName(d) : districtName(d);
    document.title = title + " | Follow the money";

    var notes = [];
    if (campus) notes.push('<p class="note"><strong>Registered to vote somewhere else?</strong> This is the race where the campus sits. If you vote at a home or off-campus address, your race may be different. Your sample ballot lists your congressional district, or you can check <a href="https://voterstatus.sos.ca.gov" target="_blank" rel="noopener">your voter status with the Secretary of State</a>.</p>');
    if (campus && campus.confidence === "near_line" && campus.alt) {
      notes.push('<p class="note verify"><strong>This campus is close to a district line.</strong> We placed ' + esc(campus.name) +
        ' using its main address, which is in the ' + ordinal(d) + ' District, but part of the campus may be in the <a href="#/district/' + campus.alt + '">' + ordinal(campus.alt) + ' District</a>.</p>');
    }
    if (campus && campus.confidence === "split") {
      notes.push('<p class="note verify"><strong>This campus spans two districts.</strong> ' + esc(campus.note) +
        (campus.alt ? ' <a href="#/district/' + campus.alt + '">See the ' + ordinal(campus.alt) + ' District race</a>.' : '') + '</p>');
    }
    if (race.sameParty) {
      notes.push('<p class="note">Both candidates are ' + esc(partyLong(cs[0].party)) + 's. California’s top-two primary sends the two leading finishers to November regardless of party.</p>');
    }

    var others = campusesIn(d).filter(function (c) { return !campus || c.id !== campus.id; });
    var maybe = campus ? [] : DATA.campuses.filter(function (c) { return c.confidence === "split" && c.alt === d; });
    var othersHtml = (others.length
      ? '<p class="others">' + (campus ? "Also in this district: " : "Schools in this district: ") + others.map(function (c) { return '<a href="#/school/' + c.id + '">' + esc(c.name) + '</a>'; }).join(", ") + '</p>'
      : "") + (maybe.length
      ? '<p class="others">Part of this campus is also in this district: ' + maybe.map(function (c) { return '<a href="#/school/' + c.id + '">' + esc(c.name) + '</a>'; }).join(", ") + '</p>'
      : "");

    main.innerHTML =
      '<a class="crumb" href="#/">All schools and districts</a>' +
      '<header class="race-head">' +
        '<h1>' + esc(title) + '</h1>' +
        '<p class="matchup">' + (race.openSeat ? "An open seat: " : "") + cs.map(candLabel).join(" vs. ") + '</p>' +
        othersHtml +
        '<div class="race-notes">' + notes.join("") + '</div>' +
      '</header>' +
      '<section class="section"><h2>Campaign money</h2>' +
        '<p class="dek">What each campaign has raised this cycle and where it came from. Bars are drawn to the same scale.</p>' +
        '<div class="duo">' + cs.map(function (c) { return moneyColumn(c, maxRaised); }).join("") + '</div>' +
      '</section>' +
      '<section class="section"><h2>Outside money</h2>' +
        '<p class="dek">Independent groups, including super PACs, can raise and spend unlimited amounts as long as they don’t coordinate with a campaign. Their names often don’t reveal who funds them.</p>' +
        (maxOut >= 1000 ? '<div class="duo">' + cs.map(function (c) { return outsideColumn(c, outScale); }).join("") + '</div>'
                        : '<p class="none">Outside groups have reported little or no spending in this race' + (maxOut > 0 ? ' (under $1,000 in total, such as website endorsements).' : '.') + '</p>') +
      '</section>' +
      '<section class="section"><h2>Who’s giving</h2>' +
        '<p class="dek">Totals combine each donor’s contributions this cycle. Names, jobs and employers are as reported to the Federal Election Commission. Donor lists can run behind the campaign totals above, because the FEC posts a report’s totals before it finishes processing each donation in it.</p>' +
        '<div class="tabs" role="tablist" aria-label="Donor lists">' + TABS.map(function (t, i) {
          return '<button type="button" role="tab" id="tab-' + t[0] + '" aria-controls="donor-panel" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '" data-k="' + t[0] + '">' + t[1] + '</button>';
        }).join("") + '</div>' +
        '<div id="donor-panel" role="tabpanel" aria-labelledby="tab-' + TABS[0][0] + '"></div>' +
      '</section>';

    var panel = document.getElementById("donor-panel");
    function show(key) {
      panel.setAttribute("aria-labelledby", "tab-" + key);
      panel.innerHTML = '<div class="duo">' + cs.map(function (c) {
        var lag = key !== "outsideGroups" && donorsLag(c);
        return '<div class="col"><p class="col-label">' + esc(c.name) + ' <span class="p">(' + esc(partyShort(c.party)) + ')</span></p>' +
          (lag ? '<p class="lag">Donations through ' + esc(longDate(lag)) + '</p>' : '') + listFor(c, key) + '</div>';
      }).join("") + '</div>';
    }
    var tabs = main.querySelectorAll('[role="tab"]');
    Array.prototype.forEach.call(tabs, function (b, i) {
      b.addEventListener("click", function () { select(i); });
      b.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowRight") { ev.preventDefault(); select((i + 1) % tabs.length, true); }
        if (ev.key === "ArrowLeft") { ev.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
    function select(i, focus) {
      Array.prototype.forEach.call(tabs, function (b, j) {
        b.setAttribute("aria-selected", String(i === j));
        b.setAttribute("tabindex", i === j ? "0" : "-1");
      });
      if (focus) tabs[i].focus();
      show(tabs[i].getAttribute("data-k"));
    }
    show(TABS[0][0]);
  }

  function renderNotFound() {
    document.title = "Not found | Follow the money";
    main.innerHTML = '<a class="crumb" href="#/">All schools and districts</a><h1 class="ask-label">That page isn’t here.</h1><p class="ask-sub">Go back to the list of schools to find your campus.</p>';
  }

  /* ------------------------------------------------------------ about */
  var FEC_LINK = '<a href="https://www.fec.gov/data/" target="_blank" rel="noopener">Federal Election Commission</a>';
  function aboutHtml(headingTag) {
    var m = DATA.meta;
    var through = esc(longDate(m.moneyThroughMostly)) +
      (m.moneyThroughLatest && m.moneyThroughLatest !== m.moneyThroughMostly
        ? " (for some though, it runs through " + esc(longDate(m.moneyThroughLatest)) + ")" : "");
    return '<' + headingTag + '>About this data</' + headingTag + '>' +
      '<p>The candidates shown are the two finalists certified by the California Secretary of State for the general election on Nov. 3, 2026. The districts on this website follow the map put forward by Proposition 50.</p>' +
      '<p>The data shown on this website was last updated on ' + esc(longDate(m.built)) + '. It comes from reports filed with the ' + FEC_LINK +
        ' and runs through ' + through + '. Donations made through ActBlue and WinRed are counted once, and quick 24- and 48-hour notices of outside spending are not double-counted against later full reports.</p>' +
      '<p>Source: ' + FEC_LINK + ', California Secretary of State.</p>' +
      '<p>All data and reporting for the site was done by me (Jackson Mills). I used a Python script to query and collect all the campaign data for each district’s race, and then built and cleaned a dataset. Using this dataset, I inputted directions into Claude for what I wanted the website to look like, and Claude wrote the code. I put this code into GitHub, and here’s what we’ve got.</p>';
  }
  /* ------------------------------------------------------------ submit an error */
  function renderErrorPage() {
    document.title = "Submit an error | Follow the money to your campus";
    var email = DATA.meta.corrections, signal = DATA.meta.signal;
    main.innerHTML =
      '<a class="crumb" href="#/">Back to home</a>' +
      '<article class="page">' +
        '<h1>Submit an error</h1>' +
        '<p class="page-intro">See an error in the data and reporting on this website? Send me a message, and I’ll get it fixed ASAP. Please tell me which school or district page you were looking at and what looks wrong.</p>' +
        '<dl class="contact-list">' +
          '<div><dt>Email</dt><dd><a href="mailto:' + esc(email) + '?subject=' + encodeURIComponent("Error report: Follow the money to your campus") + '">' + esc(email) + '</a></dd></div>' +
          '<div><dt>Signal</dt><dd>' + esc(signal) + '</dd></div>' +
        '</dl>' +
      '</article>';
  }

  /* ------------------------------------------------------------ footer */
  function renderFooter(page) {
    footer.innerHTML = '<div class="about">' + aboutHtml("h2") + '</div>';
    document.getElementById("credit").textContent = DATA.meta.credit;
  }

  /* ------------------------------------------------------------ menu */
  var menuBtn = document.getElementById("menu-button");
  var menu = document.getElementById("site-menu");
  function setMenu(open, returnFocus) {
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    if (open) { var a = menu.querySelector("a"); if (a) a.focus(); }
    else if (returnFocus) menuBtn.focus();
    postHeight();
  }
  menuBtn.addEventListener("click", function () { setMenu(menu.hidden); });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !menu.hidden) setMenu(false, true);
  });
  document.addEventListener("click", function (ev) {
    if (!menu.hidden && !menu.contains(ev.target) && !menuBtn.contains(ev.target)) setMenu(false);
  });
  menu.addEventListener("click", function (ev) {
    var a = ev.target.closest("a");
    if (!a) return;
    // Selecting the page you're already on should still close the menu.
    if (a.getAttribute("href") === location.hash || (a.getAttribute("href") === "#/" && !location.hash)) setMenu(false, true);
  });
  function markMenu(page) {
    Array.prototype.forEach.call(menu.querySelectorAll("a"), function (a) {
      if (a.getAttribute("data-page") === page) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  /* ------------------------------------------------------------ router */
  var routed = false;
  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("/");
    var page = "home";
    if (parts[0] === "school" && parts[1]) {
      var c = campusById(parts[1]);
      if (c) renderRace(c.district, c); else renderNotFound();
      page = "race";
    } else if (parts[0] === "district" && parts[1]) {
      renderRace(parseInt(parts[1], 10), null);
      page = "race";
    } else if (parts[0] === "submit-an-error") {
      renderErrorPage(); page = "error";
    } else {
      renderHome();
    }
    renderFooter(page);
    markMenu(page);
    if (!menu.hidden) setMenu(false);
    window.scrollTo(0, 0);
    if (h) main.focus({ preventScroll: true });
    postHeight();
    if (window.parent !== window && routed) window.parent.postMessage({ type: "campus-money:navigate" }, "*");
    routed = true;
  }

  fetch("data/site-data.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { DATA = d; route(); window.addEventListener("hashchange", route); })
    .catch(function () {
      main.innerHTML = '<p class="loading">The campaign finance data didn’t load. Refresh the page to try again.</p>';
    });
})();
