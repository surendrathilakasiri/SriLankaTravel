// Cities list (match your itinerary.js whitelist)
const SL_CITIES = [
  "Kandy","Colombo","Sigiriya","Dambulla","Anuradhapura","Polonnaruwa",
  "Nuwara Eliya","Ella","Haputale","Galle","Unawatuna","Mirissa",
  "Hikkaduwa","Bentota","Yala","Udawalawe","Trincomalee",
  "Jaffna","Arugam Bay","Negombo"
];

const wrap = document.getElementById("startingLocationWrap");
const citySearch = document.getElementById("citySearch");
const cityDropdown = document.getElementById("cityDropdown");
const cityFilter = document.getElementById("cityFilter");
const cityList = document.getElementById("cityList");
const hiddenWrap = document.getElementById("citiesHiddenInputs");

// Default selection = Kandy ✅
const selected = new Set(["Kandy"]);

function renderHiddenInputs(){
  hiddenWrap.innerHTML = "";
  [...selected].forEach(city => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "cities";   // IMPORTANT: your existing FormData.getAll("cities") will work
    input.value = city;
    hiddenWrap.appendChild(input);
  });
}

function updateInputText(){
  citySearch.value = [...selected].join(", ");
}

function renderList(filterText=""){
  const q = String(filterText || "").toLowerCase().trim();

  const items = SL_CITIES
    .filter(c => c.toLowerCase().includes(q))
    .map(city => {
      const checked = selected.has(city) ? "checked" : "";
      return `
        <label class="pill-row">
          <span class="pill-city">${city}</span>
          <input class="pill-check" type="checkbox" data-city="${city}" ${checked}>
        </label>
      `;
    })
    .join("");

  cityList.innerHTML = items || `<div style="padding:14px;color:rgba(255,255,255,.8);font-weight:800;">No results</div>`;

  cityList.querySelectorAll('input[type="checkbox"][data-city]').forEach(cb => {
    cb.addEventListener("change", (e) => {
      const city = e.target.getAttribute("data-city");

      if (e.target.checked) selected.add(city);
      else selected.delete(city);

      // Always keep at least one city selected; default back to Kandy
      if (selected.size === 0) selected.add("Kandy");

      renderHiddenInputs();
      updateInputText();
      renderList(cityFilter.value);
    });
  });
}

function openDropdown(){
  cityDropdown.style.display = "block";
  citySearch.setAttribute("aria-expanded", "true");
  cityFilter.value = "";
  renderList("");
  setTimeout(() => cityFilter.focus(), 0);
}

function closeDropdown(){
  cityDropdown.style.display = "none";
  citySearch.setAttribute("aria-expanded", "false");
}

// Open only when clicking the Starting Location input
citySearch.addEventListener("click", openDropdown);

// Close when clicking outside
document.addEventListener("click", (e) => {
  if (!wrap.contains(e.target)) closeDropdown();
});

// Filter
cityFilter.addEventListener("input", (e) => renderList(e.target.value));

// Init
renderHiddenInputs();
updateInputText();
renderList("");
