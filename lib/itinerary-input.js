const options = {
  arrival: ['Colombo airport (CMB)', 'Colombo city', 'Mattala airport (HRI)', 'Jaffna airport (JAF)'],
  month: ['Not decided','January','February','March','April','May','June','July','August','September','October','November','December'],
  budget: ['Not decided','Budget: USD 40–80','Comfort: USD 80–160','Premium: USD 160+'],
  pace: ['Relaxed','Balanced','Active'],
  style: ['balanced','luxury','budget','adventure','family'],
  interests: ['Beaches','Wildlife','Culture','Food','Hiking','Scenic trains']
};
export function tripPreferences(body) {
  const result = {};
  for (const key of ['arrival','month','budget','pace','style']) {
    const value = body[key] || options[key][0];
    if (!options[key].includes(value)) throw new Error(`Please choose a valid ${key}.`);
    result[key] = value;
  }
  const interests = body.interests || [];
  if (!Array.isArray(interests) || interests.length > 6 || interests.some(x => !options.interests.includes(x))) throw new Error('Please choose valid interests.');
  result.interests = interests;
  return result;
}
