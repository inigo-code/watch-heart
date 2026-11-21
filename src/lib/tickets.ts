// Booking cinema tickets in India. BookMyShow has no way in for other apps and its film pages need its own
// code for the film, which TMDB doesn't have, so a film's "Book tickets" opens the list of films showing in
// your city on BookMyShow: the film is there, and from it you pick a cinema, a show and your seats.
// seats.movie (a separate site that ranks the free seats in every show) covers ten of these cities.

export type TicketCity = { slug: string; name: string };

// BookMyShow's own name for each city in its addresses (in.bookmyshow.com/explore/movies-<slug>), each one
// checked to open that city's list (2026-11-22). Some differ from the usual spelling: Delhi-NCR is
// national-capital-region-ncr, Thiruvananthapuram is trivandrum, Mysuru is mysuru-mysore.
const LIST: [string, string][] = [
  ['agartala', 'Agartala'], ['agra', 'Agra'], ['ahmedabad', 'Ahmedabad'], ['aizawl', 'Aizawl'], ['alappuzha', 'Alappuzha'],
  ['amritsar', 'Amritsar'], ['anantapur', 'Anantapur'], ['aurangabad', 'Aurangabad'], ['belagavi-belgaum', 'Belagavi (Belgaum)'],
  ['bellary', 'Ballari (Bellary)'], ['bengaluru', 'Bengaluru'], ['bhimavaram', 'Bhimavaram'], ['bhopal', 'Bhopal'],
  ['bhubaneswar', 'Bhubaneswar'], ['bilaspur', 'Bilaspur'], ['chandigarh', 'Chandigarh'], ['chennai', 'Chennai'],
  ['chittoor', 'Chittoor'], ['coimbatore', 'Coimbatore'], ['cuttack', 'Cuttack'], ['davanagere', 'Davanagere'],
  ['dehradun', 'Dehradun'], ['national-capital-region-ncr', 'Delhi-NCR'], ['dhanbad', 'Dhanbad'], ['dharwad', 'Dharwad'],
  ['dindigul', 'Dindigul'], ['eluru', 'Eluru'], ['erode', 'Erode'], ['gangtok', 'Gangtok'], ['goa', 'Goa'], ['guntur', 'Guntur'],
  ['gurugram', 'Gurugram'], ['guwahati', 'Guwahati'], ['gwalior', 'Gwalior'], ['hosur', 'Hosur'], ['hubli', 'Hubballi (Hubli)'],
  ['hyderabad', 'Hyderabad'], ['imphal', 'Imphal'], ['indore', 'Indore'], ['jabalpur', 'Jabalpur'], ['jaipur', 'Jaipur'],
  ['jalandhar', 'Jalandhar'], ['jammu', 'Jammu'], ['jamshedpur', 'Jamshedpur'], ['jodhpur', 'Jodhpur'], ['kadapa', 'Kadapa'],
  ['kakinada', 'Kakinada'], ['kalaburagi-gulbarga', 'Kalaburagi (Gulbarga)'], ['kannur', 'Kannur'], ['kanpur', 'Kanpur'],
  ['karimnagar', 'Karimnagar'], ['karur', 'Karur'], ['kasaragod', 'Kasaragod'], ['khammam', 'Khammam'], ['kochi', 'Kochi'],
  ['kohima', 'Kohima'], ['kolhapur', 'Kolhapur'], ['kolkata', 'Kolkata'], ['kollam', 'Kollam'], ['kottayam', 'Kottayam'],
  ['kozhikode', 'Kozhikode'], ['kumbakonam', 'Kumbakonam'], ['kurnool', 'Kurnool'], ['leh', 'Leh'], ['lucknow', 'Lucknow'],
  ['ludhiana', 'Ludhiana'], ['machilipatnam', 'Machilipatnam'], ['madanapalle', 'Madanapalle'], ['madurai', 'Madurai'],
  ['malappuram', 'Malappuram'], ['mangaluru-mangalore', 'Mangaluru (Mangalore)'], ['manipal', 'Manipal'], ['margao', 'Margao'],
  ['meerut', 'Meerut'], ['mumbai', 'Mumbai'], ['mysuru-mysore', 'Mysuru (Mysore)'], ['nagercoil', 'Nagercoil'], ['nagpur', 'Nagpur'],
  ['nashik', 'Nashik'], ['navi-mumbai', 'Navi Mumbai'], ['nellore', 'Nellore'], ['nizamabad', 'Nizamabad'], ['noida', 'Noida'],
  ['ongole', 'Ongole'], ['palakkad', 'Palakkad'], ['panaji', 'Panaji'], ['pathanamthitta', 'Pathanamthitta'], ['patna', 'Patna'],
  ['pollachi', 'Pollachi'], ['pondicherry', 'Puducherry'], ['port-blair', 'Port Blair'], ['prayagraj-allahabad', 'Prayagraj (Allahabad)'],
  ['pune', 'Pune'], ['raipur', 'Raipur'], ['rajkot', 'Rajkot'], ['ranchi', 'Ranchi'], ['salem', 'Salem'], ['shillong', 'Shillong'],
  ['shimla', 'Shimla'], ['shivamogga', 'Shivamogga'], ['siliguri', 'Siliguri'], ['solapur', 'Solapur'], ['srikakulam', 'Srikakulam'],
  ['srinagar', 'Srinagar'], ['surat', 'Surat'], ['tenali', 'Tenali'], ['thane', 'Thane'], ['thanjavur', 'Thanjavur'],
  ['thrissur', 'Thrissur'], ['tiruchirappalli', 'Tiruchirappalli'], ['tirunelveli', 'Tirunelveli'], ['tirupati', 'Tirupati'],
  ['tiruppur', 'Tiruppur'], ['trivandrum', 'Thiruvananthapuram'], ['tumakuru-tumkur', 'Tumakuru (Tumkur)'], ['udaipur', 'Udaipur'],
  ['udupi', 'Udupi'], ['vadodara', 'Vadodara'], ['varanasi', 'Varanasi'], ['vellore', 'Vellore'], ['vijayawada', 'Vijayawada'],
  ['visakhapatnam', 'Visakhapatnam'], ['vizianagaram', 'Vizianagaram'], ['warangal', 'Warangal'],
];

// BookMyShow's popular cities, which seats.movie covers too.
const POPULAR = ['mumbai', 'national-capital-region-ncr', 'bengaluru', 'hyderabad', 'chandigarh', 'ahmedabad', 'pune', 'chennai', 'kolkata', 'kochi'];
const SEAT_CITIES = new Set(POPULAR);

const byName = (a: TicketCity, b: TicketCity) => a.name.localeCompare(b.name);
const ALL = LIST.map(([slug, name]) => ({ slug, name }));

/** Every city for the picker: the ten popular ones first (as BookMyShow lists them), then the rest A to Z. */
export const TICKET_CITIES: TicketCity[] = [
  ...ALL.filter((c) => SEAT_CITIES.has(c.slug)).sort(byName),
  ...ALL.filter((c) => !SEAT_CITIES.has(c.slug)).sort(byName),
];

export const ticketCityName = (slug: string) => TICKET_CITIES.find((c) => c.slug === slug)?.name ?? null;

/** BookMyShow's list of the films showing in a city. */
export const bookMyShowUrl = (slug: string) => `https://in.bookmyshow.com/explore/movies-${slug}`;

/** seats.movie's page for a city, or null where it doesn't cover it. */
export const bestSeatsUrl = (slug: string) => (SEAT_CITIES.has(slug) ? `https://seats.movie/${slug}` : null);

const DAY = 86_400_000;

/**
 * Whether a film can be booked: it opened in cinemas in the last six weeks, or opens within 30 days (big films
 * open advance booking weeks ahead, and BookMyShow lists them before). `cinemaDay` and `today` are YYYY-MM-DD.
 */
export function bookable(cinemaDay: string | null | undefined, today: string): boolean {
  if (!cinemaDay) return false;
  const days = Math.round((Date.parse(cinemaDay.slice(0, 10)) - Date.parse(today)) / DAY);
  return days >= -42 && days <= 30;
}
