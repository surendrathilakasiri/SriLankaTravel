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

// ✅ default
const selected = new Set(["Kandy"]);

function cleanCity(s){
  return String(s || "").trim().replace(/\s+/g, " ");
}

function renderHiddenInputs(){
  hiddenWrap.innerHTML = "";
  [...selected].forEach(city => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "cities";
    input.value = city;
    hiddenWrap.appendChild(input);
  });
}

function updateInputText(){
  citySearch.value = [...selected].join(", ");
}

function openDropdown(){
  cityDropdown.style.display = "block";
  citySearch.setAttribute("aria-expanded", "true");
  setTimeout(() => cityFilter.focus(), 0);
}

function closeDropdown(){
  cityDropdown.style.display = "none";
  citySearch.setAttribute("aria-expanded", "false");
}

function renderList(filterText=""){
  const q = String(filterText || "").toLowerCase().trim();
  const filtered = SL_CITIES.filter(c => c.toLowerCase().includes(q));

  cityList.innerHTML = filtered.map(city => {
    const checked = selected.has(city) ? "checked" : "";
    return `
      <label class="pill-row">
        <span class="pill-city">${city}</span>
        <input class="pill-check" type="checkbox" data-city="${city}" ${checked}>
      </label>
    `;
  }).join("") || `<div style="padding:14px;color:rgba(255,255,255,.8);font-weight:700;">No results</div>`;

  cityList.querySelectorAll('input[type="checkbox"][data-city]').forEach(cb => {
    cb.addEventListener("change", (e) => {
      const city = e.target.getAttribute("data-city");
      if (e.target.checked) selected.add(city);
      else selected.delete(city);

      if (selected.size === 0) selected.add("Kandy");
      renderHiddenInputs();
      updateInputText();
      renderList(cityFilter.value);
    });
  });
}

// ✅ Add custom city from typing
function addCustomCityFromInput(){
  const custom = cleanCity(citySearch.value);
  if (!custom) return;

  // Avoid duplicates (case-insensitive)
  const exists = [...selected].some(x => x.toLowerCase() === custom.toLowerCase());
  if (!exists) selected.add(custom);

  renderHiddenInputs();
  updateInputText();
  closeDropdown();
}

// Open dropdown on focus/click
citySearch.addEventListener("focus", openDropdown);
citySearch.addEventListener("click", openDropdown);

// Typing in citySearch also filters dropdown
citySearch.addEventListener("input", () => {
  openDropdown();
  cityFilter.value = citySearch.value;
  renderList(citySearch.value);
});

// Enter adds custom city
citySearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addCustomCityFromInput();
  }
});

// Dropdown filter input
cityFilter.addEventListener("input", (e) => renderList(e.target.value));

// Click outside closes
document.addEventListener("click", (e) => {
  if (!wrap.contains(e.target)) closeDropdown();
});

// Init
renderHiddenInputs();
updateInputText();
renderList("");
