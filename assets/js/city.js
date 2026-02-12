document.addEventListener("DOMContentLoaded", () => {
    const wrap = document.getElementById("startingLocationWrap");
    const citySearch = document.getElementById("citySearch");
    const cityDropdown = document.getElementById("cityDropdown");
    const cityFilter = document.getElementById("cityFilter");
    const cityList = document.getElementById("cityList");
    const hiddenWrap = document.getElementById("citiesHiddenInputs");
  
    if (!wrap || !citySearch || !cityDropdown || !cityFilter || !cityList || !hiddenWrap) {
      console.error("City dropdown: missing element(s). Check IDs.");
      return;
    }
  
    // ---- 20 Most Important Places (Top Picks ⭐) ----
    // Use these as “priority” labels in UI. (Also great for your itinerary prompt later.)
    const TOP_PICKS = new Set([
      "Sigiriya",
      "Kandy",
      "Ella",
      "Nuwara Eliya",
      "Galle",
      "Mirissa",
      "Yala",
      "Udawalawe",
      "Dambulla",
      "Anuradhapura",
      "Polonnaruwa",
      "Trincomalee",
      "Jaffna",
      "Horton Plains",
      "Adam's Peak",
      "Sinharaja",
      "Arugam Bay",
      "Hikkaduwa",
      "Bentota",
      "Knuckles"
    ]);
  
    // ---- Grouped cities (tourism friendly) ----
    const CITY_GROUPS = [
      {
        group: "Top Picks",
        items: [
          "Kandy","Sigiriya","Ella","Nuwara Eliya","Galle","Mirissa",
          "Yala","Udawalawe","Dambulla","Anuradhapura","Polonnaruwa",
          "Trincomalee","Jaffna","Horton Plains","Adam's Peak",
          "Sinharaja","Arugam Bay","Hikkaduwa","Bentota","Knuckles"
        ]
      },
      {
        group: "Cultural Triangle",
        items: ["Sigiriya","Dambulla","Anuradhapura","Polonnaruwa","Habarana","Minneriya","Kaudulla"]
      },
      {
        group: "Hill Country",
        items: ["Kandy","Nuwara Eliya","Ella","Haputale","Badulla","Hatton","Knuckles","Horton Plains"]
      },
      {
        group: "South Coast",
        items: ["Galle","Unawatuna","Hikkaduwa","Weligama","Mirissa","Matara","Tangalle","Bentota","Beruwala"]
      },
      {
        group: "East Coast",
        items: ["Trincomalee","Nilaveli","Pasikuda","Batticaloa","Arugam Bay"]
      },
      {
        group: "Wildlife & Nature",
        items: ["Yala","Udawalawe","Wilpattu","Sinharaja","Kitulgala"]
      },
      {
        group: "Colombo & West",
        items: ["Colombo","Negombo","Kalutara","Gampaha","Puttalam","Kalpitiya"]
      },
      {
        group: "North",
        items: ["Jaffna","Kilinochchi","Mannar","Vavuniya"]
      }
    ];
  
    // Build a unique “all cities” list for searching
    const ALL_CITIES = [...new Set(CITY_GROUPS.flatMap(g => g.items))].sort((a,b) => a.localeCompare(b));
  
    // ✅ default
    const selected = new Set();
  
    // Chips line inside the field (optional but nice)
    const chipsLine = document.createElement("div");
    chipsLine.className = "pill-chipline";
    wrap.appendChild(chipsLine);
  
    function cleanCity(s){
      return String(s || "").trim().replace(/\s+/g, " ");
    }
  
    function addCitiesFromText(text){
      // allow "Matara, Tangalle"
      const parts = String(text || "")
        .split(",")
        .map(cleanCity)
        .filter(Boolean);
  
      for (const c of parts) {
        if (c.length < 2 || c.length > 40) continue; // basic sanity
        const exists = [...selected].some(x => x.toLowerCase() === c.toLowerCase());
        if (!exists) selected.add(c);
      }
  
    }
  
    function renderHiddenInputs(){
      hiddenWrap.innerHTML = "";
      [...selected].forEach(city => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "cities";   // IMPORTANT: FormData.getAll("cities") works
        input.value = city;
        hiddenWrap.appendChild(input);
      });
    }
  
    function renderChips(){
      chipsLine.innerHTML = "";
      [...selected].forEach(city => {
        const chip = document.createElement("span");
        chip.className = "pill-chip";
        chip.innerHTML = `
          ${TOP_PICKS.has(city) ? `<span class="pill-star">⭐</span>` : ``}
          <span>${city}</span>
          <button type="button" aria-label="Remove ${city}">×</button>
        `;
        chip.querySelector("button").addEventListener("click", () => {
          selected.delete(city);
          renderHiddenInputs();
          //renderChips();
          setDisplayValue();
          renderList(cityFilter.value);
        });
        chipsLine.appendChild(chip);
      });
    }
  
    function setDisplayValue(){
      const list = [...selected];
      if (list.length > 0) {
        citySearch.value = list.join(", ");
        citySearch.placeholder = "";
      } else {
        citySearch.value = "";
        citySearch.placeholder = "Select one or more cities…";
      }
    }
    
    
    function openDropdown(){
      cityDropdown.style.display = "block";
      citySearch.setAttribute("aria-expanded", "true");
    }
  
    function closeDropdown(){
      cityDropdown.style.display = "none";
      citySearch.setAttribute("aria-expanded", "false");
    }
  
    function rowHtml(city){
      const checked = selected.has(city) ? "checked" : "";
      const star = TOP_PICKS.has(city) ? `<span class="pill-star">⭐</span>` : `<span class="pill-star" style="opacity:.25;">•</span>`;
      return `
        <label class="pill-row">
          <span class="pill-city">${star}<span>${city}</span></span>
          <input class="pill-check" type="checkbox" data-city="${city}" ${checked}>
        </label>
      `;
    }
  
    function renderList(filterText=""){
      const q = String(filterText || "").toLowerCase().trim();
      const useSearch = q.length > 0;
  
      if (useSearch) {
        const filtered = ALL_CITIES.filter(c => c.toLowerCase().includes(q));
        cityList.innerHTML = filtered.length
          ? filtered.map(rowHtml).join("")
          : `<div class="pill-hint">No results. Press Enter to add: <b>${filterText}</b></div>`;
      } else {
        // grouped view
        cityList.innerHTML = CITY_GROUPS.map(g => {
          const items = g.items.map(rowHtml).join("");
          return `
            <div class="pill-dropdown-group">${g.group}</div>
            ${items}
          `;
        }).join("");
      }
  
      cityList.querySelectorAll('input[type="checkbox"][data-city]').forEach(cb => {
        cb.addEventListener("change", (e) => {
          const city = e.target.getAttribute("data-city");
          if (e.target.checked) selected.add(city);
          else selected.delete(city);
  
  
          renderHiddenInputs();
          //renderChips();
          setDisplayValue();
          renderList(cityFilter.value);
        });
      });
    }
  
    // Prevent Enter from submitting form when using the city fields
    function stopEnterSubmit(e){
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
      return false;
    }
  
    const form = citySearch.closest("form");
    form?.addEventListener("keydown", (e) => {
      const a = document.activeElement;
      if (a === citySearch || a === cityFilter) stopEnterSubmit(e);
    });
  
    // Open dropdown when clicking in the input
    citySearch.addEventListener("click", () => {
      openDropdown();
      cityFilter.value = "";
      renderList("");
      setTimeout(() => cityFilter.focus(), 0);
    });
  
    // If user types in main input, treat it as quick search
    citySearch.addEventListener("input", () => {
      openDropdown();
      cityFilter.value = citySearch.value;
      renderList(citySearch.value);
    });
  
    // Enter in main input -> add custom city/cities
    citySearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        stopEnterSubmit(e);
        addCitiesFromText(citySearch.value);
        renderHiddenInputs();
        //renderChips();
        setDisplayValue();
        closeDropdown();
      }
    });
  
    // Dropdown filter
    cityFilter.addEventListener("input", (e) => renderList(e.target.value));
    cityFilter.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        stopEnterSubmit(e);
        addCitiesFromText(cityFilter.value);
        renderHiddenInputs();
        //renderChips();
        setDisplayValue();
        closeDropdown();
      }
    });
  
    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) closeDropdown();
    });
  
    // Init
    renderHiddenInputs();
    renderChips();
    setDisplayValue();
    renderList("");
  });

  const errorEl = document.getElementById("cityError");

  form?.addEventListener("submit", (e) => {
    if (selected.size === 0) {
      e.preventDefault();
      errorEl.style.display = "block";
    } else {
      errorEl.style.display = "none";
    }
  });
    