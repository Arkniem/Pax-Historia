
import { GameState, Country, Territory, MapData, City } from '../types';
import * as TopoJSON from 'topojson-client';

export const stringToColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

// Hashing function for deterministic "random" numbers
const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

const REAL_WORLD_DATA: { [countryName: string]: { gdp: number; population: number; stability: number; militaryStrength: number; militaryTech: number; } } = {
    // Names should match the `name` property in the world-atlas geojson
    "United States of America": { gdp: 27360, population: 333, stability: 75, militaryStrength: 100, militaryTech: 10 },
    "China": { gdp: 17730, population: 1425, stability: 70, militaryStrength: 95, militaryTech: 9 },
    "Germany": { gdp: 4450, population: 84, stability: 85, militaryStrength: 60, militaryTech: 8 },
    "Japan": { gdp: 4230, population: 125, stability: 90, militaryStrength: 65, militaryTech: 9 },
    "India": { gdp: 3730, population: 1428, stability: 60, militaryStrength: 85, militaryTech: 7 },
    "United Kingdom": { gdp: 3330, population: 67, stability: 78, militaryStrength: 70, militaryTech: 9 },
    "France": { gdp: 3050, population: 65, stability: 80, militaryStrength: 68, militaryTech: 9 },
    "Russia": { gdp: 1860, population: 144, stability: 40, militaryStrength: 92, militaryTech: 9 },
    "Canada": { gdp: 2120, population: 38, stability: 90, militaryStrength: 50, militaryTech: 8 },
    "Brazil": { gdp: 2130, population: 215, stability: 55, militaryStrength: 62, militaryTech: 6 },
    "Australia": { gdp: 1690, population: 26, stability: 92, militaryStrength: 55, militaryTech: 8 },
    "Italy": { gdp: 2190, population: 59, stability: 70, militaryStrength: 63, militaryTech: 8 },
    "South Korea": { gdp: 1710, population: 52, stability: 82, militaryStrength: 72, militaryTech: 9 },
    "Iran": { gdp: 413, population: 88, stability: 30, militaryStrength: 75, militaryTech: 6 },
    "Turkey": { gdp: 1150, population: 85, stability: 50, militaryStrength: 78, militaryTech: 7 },
    "Israel": { gdp: 525, population: 9, stability: 65, militaryStrength: 76, militaryTech: 9 },
    "Saudi Arabia": { gdp: 1110, population: 36, stability: 68, militaryStrength: 69, militaryTech: 8 },
    "North Korea": { gdp: 18, population: 26, stability: 20, militaryStrength: 74, militaryTech: 5 },
    "Ukraine": { gdp: 160, population: 43, stability: 25, militaryStrength: 80, militaryTech: 7 },
    "Pakistan": { gdp: 376, population: 236, stability: 45, militaryStrength: 82, militaryTech: 6 },
    "Egypt": { gdp: 378, population: 111, stability: 55, militaryStrength: 79, militaryTech: 7 },
};

const INITIAL_CITIES: Omit<City, 'id'>[] = [
    // North America
    { name: "Washington D.C.", coordinates: [-77.0369, 38.9072], territoryId: "USA-11", isCapital: true },
    { name: "New York", coordinates: [-74.0060, 40.7128], territoryId: "USA-36", isCapital: false },
    { name: "Los Angeles", coordinates: [-118.2437, 34.0522], territoryId: "USA-06", isCapital: false },
    { name: "Chicago", coordinates: [-87.6298, 41.8781], territoryId: "USA-17", isCapital: false },
    { name: "Boston", coordinates: [-71.0589, 42.3601], territoryId: "USA-25", isCapital: false },
    { name: "Mexico City", coordinates: [-99.1332, 19.4326], territoryId: "Mexico", isCapital: true },
    { name: "Tenochtitlan", coordinates: [-99.1332, 19.4326], territoryId: "Mexico", isCapital: false }, // Historical alias
    { name: "Ottawa", coordinates: [-75.6972, 45.4215], territoryId: "Canada", isCapital: true },
    { name: "Toronto", coordinates: [-79.3832, 43.6532], territoryId: "Canada", isCapital: false },
    { name: "Montreal", coordinates: [-73.5673, 45.5017], territoryId: "Canada", isCapital: false },
    { name: "Havana", coordinates: [-82.3666, 23.1136], territoryId: "Cuba", isCapital: true },
    { name: "Santo Domingo", coordinates: [-69.9312, 18.4861], territoryId: "Dominican Rep.", isCapital: true },
    { name: "Guatemala City", coordinates: [-90.5069, 14.6349], territoryId: "Guatemala", isCapital: true },
    { name: "Belmopan", coordinates: [-88.759, 17.251], territoryId: "Belize", isCapital: true },
    { name: "San Salvador", coordinates: [-89.2182, 13.6929], territoryId: "El Salvador", isCapital: true },
    { name: "Tegucigalpa", coordinates: [-87.2068, 14.0723], territoryId: "Honduras", isCapital: true },
    { name: "Managua", coordinates: [-86.2362, 12.1150], territoryId: "Nicaragua", isCapital: true },
    { name: "San José", coordinates: [-84.0907, 9.9281], territoryId: "Costa Rica", isCapital: true },
    { name: "Panama City", coordinates: [-79.5199, 8.9824], territoryId: "Panama", isCapital: true },
    { name: "Kingston", coordinates: [-76.7920, 17.9712], territoryId: "Jamaica", isCapital: true },
    { name: "Port-au-Prince", coordinates: [-72.3375, 18.5945], territoryId: "Haiti", isCapital: true },
    { name: "Nassau", coordinates: [-77.3554, 25.0479], territoryId: "The Bahamas", isCapital: true },

    // South America
    { name: "Cusco", coordinates: [-71.9675, -13.5320], territoryId: "Peru", isCapital: false }, // Incan Capital
    { name: "Lima", coordinates: [-77.0428, -12.0464], territoryId: "Peru", isCapital: true },
    { name: "Bogotá", coordinates: [-74.0721, 4.7110], territoryId: "Colombia", isCapital: true },
    { name: "Brasília", coordinates: [-47.8825, -15.7942], territoryId: "Brazil", isCapital: true },
    { name: "Rio de Janeiro", coordinates: [-43.1729, -22.9068], territoryId: "Brazil", isCapital: false },
    { name: "São Paulo", coordinates: [-46.6333, -23.5505], territoryId: "Brazil", isCapital: false },
    { name: "Buenos Aires", coordinates: [-58.3816, -34.6037], territoryId: "Argentina", isCapital: true },
    { name: "Santiago", coordinates: [-70.6693, -33.4489], territoryId: "Chile", isCapital: true },
    { name: "Caracas", coordinates: [-66.9036, 10.4806], territoryId: "Venezuela", isCapital: true },
    { name: "Quito", coordinates: [-78.4678, -0.1807], territoryId: "Ecuador", isCapital: true },
    { name: "La Paz", coordinates: [-68.1193, -16.4897], territoryId: "Bolivia", isCapital: true },
    { name: "Asunción", coordinates: [-57.5759, -25.2637], territoryId: "Paraguay", isCapital: true },
    { name: "Montevideo", coordinates: [-56.1645, -34.9011], territoryId: "Uruguay", isCapital: true },
    { name: "Georgetown", coordinates: [-58.1551, 6.8013], territoryId: "Guyana", isCapital: true },
    { name: "Paramaribo", coordinates: [-55.2038, 5.8520], territoryId: "Suriname", isCapital: true },

    // Europe - West & Central
    { name: "London", coordinates: [-0.1278, 51.5074], territoryId: "United Kingdom", isCapital: true },
    { name: "Paris", coordinates: [2.3522, 48.8566], territoryId: "France", isCapital: true },
    { name: "Rome", coordinates: [12.4964, 41.9028], territoryId: "Italy", isCapital: true },
    { name: "Madrid", coordinates: [-3.7038, 40.4168], territoryId: "Spain", isCapital: true },
    { name: "Lisbon", coordinates: [-9.1393, 38.7223], territoryId: "Portugal", isCapital: true },
    { name: "Berlin", coordinates: [13.4050, 52.5200], territoryId: "Germany", isCapital: true },
    { name: "Vienna", coordinates: [16.3738, 48.2082], territoryId: "Austria", isCapital: true },
    { name: "Prague", coordinates: [14.4378, 50.0755], territoryId: "Czechia", isCapital: true },
    { name: "Warsaw", coordinates: [21.0122, 52.2297], territoryId: "Poland", isCapital: true },
    { name: "Budapest", coordinates: [19.0402, 47.4979], territoryId: "Hungary", isCapital: true },
    { name: "Amsterdam", coordinates: [4.8952, 52.3702], territoryId: "Netherlands", isCapital: true },
    { name: "Brussels", coordinates: [4.3517, 50.8503], territoryId: "Belgium", isCapital: true },
    { name: "Geneva", coordinates: [6.1432, 46.2044], territoryId: "Switzerland", isCapital: false },
    { name: "Bern", coordinates: [7.4474, 46.9480], territoryId: "Switzerland", isCapital: true },
    { name: "Dublin", coordinates: [-6.2603, 53.3498], territoryId: "Ireland", isCapital: true },
    { name: "Luxembourg City", coordinates: [6.1296, 49.6116], territoryId: "Luxembourg", isCapital: true },
    { name: "Bratislava", coordinates: [17.1077, 48.1486], territoryId: "Slovakia", isCapital: true },

    // Europe - North
    { name: "Copenhagen", coordinates: [12.5683, 55.6761], territoryId: "Denmark", isCapital: true },
    { name: "Stockholm", coordinates: [18.0686, 59.3293], territoryId: "Sweden", isCapital: true },
    { name: "Oslo", coordinates: [10.7522, 59.9139], territoryId: "Norway", isCapital: true },
    { name: "Helsinki", coordinates: [24.9384, 60.1699], territoryId: "Finland", isCapital: true },
    { name: "Reykjavik", coordinates: [-21.8174, 64.1265], territoryId: "Iceland", isCapital: true },
    { name: "Tallinn", coordinates: [24.7536, 59.4370], territoryId: "Estonia", isCapital: true },
    { name: "Riga", coordinates: [24.1052, 56.9496], territoryId: "Latvia", isCapital: true },
    { name: "Vilnius", coordinates: [25.2797, 54.6872], territoryId: "Lithuania", isCapital: true },

    // Europe - East & Southeast
    { name: "Moscow", coordinates: [37.6173, 55.7558], territoryId: "Russia", isCapital: true },
    { name: "St. Petersburg", coordinates: [30.3351, 59.9343], territoryId: "Russia", isCapital: false },
    { name: "Kyiv", coordinates: [30.5234, 50.4501], territoryId: "Ukraine", isCapital: true },
    { name: "Minsk", coordinates: [27.5615, 53.9045], territoryId: "Belarus", isCapital: true },
    { name: "Athens", coordinates: [23.7275, 37.9838], territoryId: "Greece", isCapital: true },
    { name: "Istanbul", coordinates: [28.9784, 41.0082], territoryId: "Turkey", isCapital: false }, // Constantinople
    { name: "Ankara", coordinates: [32.8597, 39.9334], territoryId: "Turkey", isCapital: true },
    { name: "Bucharest", coordinates: [26.1025, 44.4268], territoryId: "Romania", isCapital: true },
    { name: "Belgrade", coordinates: [20.4489, 44.7866], territoryId: "Serbia", isCapital: true },
    { name: "Sofia", coordinates: [23.3219, 42.6977], territoryId: "Bulgaria", isCapital: true },
    { name: "Ljubljana", coordinates: [14.5058, 46.0569], territoryId: "Slovenia", isCapital: true },
    { name: "Zagreb", coordinates: [15.9819, 45.8150], territoryId: "Croatia", isCapital: true },
    { name: "Sarajevo", coordinates: [18.4131, 43.8563], territoryId: "Bosnia and Herz.", isCapital: true },
    { name: "Skopje", coordinates: [21.4254, 41.9981], territoryId: "North Macedonia", isCapital: true },
    { name: "Tirana", coordinates: [19.8187, 41.3275], territoryId: "Albania", isCapital: true },
    { name: "Pristina", coordinates: [21.1655, 42.6629], territoryId: "Kosovo", isCapital: true },

    // Middle East & Central Asia
    { name: "Jerusalem", coordinates: [35.2137, 31.7683], territoryId: "Israel", isCapital: true },
    { name: "Mecca", coordinates: [39.8262, 21.4225], territoryId: "Saudi Arabia", isCapital: false },
    { name: "Riyadh", coordinates: [46.7386, 24.7742], territoryId: "Saudi Arabia", isCapital: true },
    { name: "Baghdad", coordinates: [44.3661, 33.3152], territoryId: "Iraq", isCapital: true },
    { name: "Babylon", coordinates: [44.4208, 32.5422], territoryId: "Iraq", isCapital: false }, // Ancient city
    { name: "Damascus", coordinates: [36.2765, 33.5138], territoryId: "Syria", isCapital: true },
    { name: "Tehran", coordinates: [51.3890, 35.6892], territoryId: "Iran", isCapital: true },
    { name: "Isfahan", coordinates: [51.6680, 32.6546], territoryId: "Iran", isCapital: false }, // Safavid capital
    { name: "Samarkand", coordinates: [66.9749, 39.6548], territoryId: "Uzbekistan", isCapital: false }, // Silk Road hub
    { name: "Tashkent", coordinates: [69.2401, 41.2995], territoryId: "Uzbekistan", isCapital: true },
    { name: "Kabul", coordinates: [69.1723, 34.5553], territoryId: "Afghanistan", isCapital: true },
    { name: "Dubai", coordinates: [55.2708, 25.2048], territoryId: "United Arab Emirates", isCapital: false },
    { name: "Abu Dhabi", coordinates: [54.3773, 24.4539], territoryId: "United Arab Emirates", isCapital: true },
    { name: "Amman", coordinates: [35.9232, 31.9544], territoryId: "Jordan", isCapital: true },
    { name: "Beirut", coordinates: [35.5018, 33.8938], territoryId: "Lebanon", isCapital: true },
    { name: "Doha", coordinates: [51.5310, 25.2854], territoryId: "Qatar", isCapital: true },
    { name: "Kuwait City", coordinates: [47.9774, 29.3759], territoryId: "Kuwait", isCapital: true },
    { name: "Manama", coordinates: [50.5860, 26.2285], territoryId: "Bahrain", isCapital: true },
    { name: "Muscat", coordinates: [58.3829, 23.5882], territoryId: "Oman", isCapital: true },
    { name: "Sana'a", coordinates: [44.2064, 15.3694], territoryId: "Yemen", isCapital: true },
    { name: "Baku", coordinates: [49.8671, 40.4093], territoryId: "Azerbaijan", isCapital: true },
    { name: "Tbilisi", coordinates: [44.7833, 41.7151], territoryId: "Georgia", isCapital: true },
    { name: "Yerevan", coordinates: [44.5152, 40.1872], territoryId: "Armenia", isCapital: true },
    { name: "Nur-Sultan", coordinates: [71.4704, 51.1605], territoryId: "Kazakhstan", isCapital: true },
    { name: "Bishkek", coordinates: [74.5698, 42.8746], territoryId: "Kyrgyzstan", isCapital: true },
    { name: "Ashgabat", coordinates: [58.3833, 37.9500], territoryId: "Turkmenistan", isCapital: true },
    { name: "Dushanbe", coordinates: [68.7864, 38.5598], territoryId: "Tajikistan", isCapital: true },

    // Africa
    { name: "Cairo", coordinates: [31.2357, 30.0444], territoryId: "Egypt", isCapital: true },
    { name: "Alexandria", coordinates: [29.9187, 31.2001], territoryId: "Egypt", isCapital: false }, // Hellenistic center
    { name: "Thebes", coordinates: [32.6396, 25.6872], territoryId: "Egypt", isCapital: false }, // Ancient capital
    { name: "Carthage", coordinates: [10.3230, 36.8530], territoryId: "Tunisia", isCapital: false }, // Ancient city
    { name: "Tunis", coordinates: [10.1815, 36.8065], territoryId: "Tunisia", isCapital: true },
    { name: "Marrakech", coordinates: [-7.9811, 31.6295], territoryId: "Morocco", isCapital: false },
    { name: "Rabat", coordinates: [-6.8498, 33.9716], territoryId: "Morocco", isCapital: true },
    { name: "Algiers", coordinates: [3.0588, 36.7764], territoryId: "Algeria", isCapital: true },
    { name: "Tripoli", coordinates: [13.1913, 32.8872], territoryId: "Libya", isCapital: true },
    { name: "Timbuktu", coordinates: [-3.0074, 16.7734], territoryId: "Mali", isCapital: false }, // Historic trade/learning center
    { name: "Bamako", coordinates: [-7.9865, 12.6392], territoryId: "Mali", isCapital: true },
    { name: "Addis Ababa", coordinates: [38.7578, 9.0054], territoryId: "Ethiopia", isCapital: true },
    { name: "Axum", coordinates: [38.7181, 14.1256], territoryId: "Ethiopia", isCapital: false }, // Ancient Aksumite capital
    { name: "Great Zimbabwe", coordinates: [30.9309, -20.2785], territoryId: "Zimbabwe", isCapital: false }, // Historical city
    { name: "Harare", coordinates: [31.0530, -17.8252], territoryId: "Zimbabwe", isCapital: true },
    { name: "Lagos", coordinates: [3.3792, 6.5244], territoryId: "Nigeria", isCapital: false },
    { name: "Abuja", coordinates: [7.4951, 9.0579], territoryId: "Nigeria", isCapital: true },
    { name: "Kinshasa", coordinates: [15.2663, -4.4419], territoryId: "Dem. Rep. Congo", isCapital: true },
    { name: "Cape Town", coordinates: [18.4241, -33.9249], territoryId: "South Africa", isCapital: false },
    { name: "Pretoria", coordinates: [28.1881, -25.7461], territoryId: "South Africa", isCapital: true },
    { name: "Nairobi", coordinates: [36.8219, -1.2921], territoryId: "Kenya", isCapital: true },
    { name: "Dakar", coordinates: [-17.4677, 14.7167], territoryId: "Senegal", isCapital: true },
    { name: "Accra", coordinates: [-0.2057, 5.6037], territoryId: "Ghana", isCapital: true },
    { name: "Abidjan", coordinates: [-4.0083, 5.3599], territoryId: "Côte d'Ivoire", isCapital: false },
    { name: "Khartoum", coordinates: [32.5599, 15.5007], territoryId: "Sudan", isCapital: true },
    { name: "Juba", coordinates: [31.5725, 4.8593], territoryId: "S. Sudan", isCapital: true },
    { name: "Kampala", coordinates: [32.5825, 0.3476], territoryId: "Uganda", isCapital: true },
    { name: "Dar es Salaam", coordinates: [39.2083, -6.7924], territoryId: "Tanzania", isCapital: false },
    { name: "Dodoma", coordinates: [35.7516, -6.1630], territoryId: "Tanzania", isCapital: true },
    { name: "Luanda", coordinates: [13.2343, -8.8399], territoryId: "Angola", isCapital: true },
    { name: "Lusaka", coordinates: [28.2833, -15.4167], territoryId: "Zambia", isCapital: true },
    { name: "Windhoek", coordinates: [17.0836, -22.5594], territoryId: "Namibia", isCapital: true },
    { name: "Gaborone", coordinates: [25.9201, -24.6541], territoryId: "Botswana", isCapital: true },
    { name: "Antananarivo", coordinates: [47.5214, -18.8792], territoryId: "Madagascar", isCapital: true },
    { name: "Yaoundé", coordinates: [11.5021, 3.8480], territoryId: "Cameroon", isCapital: true },

    // Asia - East
    { name: "Beijing", coordinates: [116.4074, 39.9042], territoryId: "China", isCapital: true },
    { name: "Shanghai", coordinates: [121.4737, 31.2304], territoryId: "China", isCapital: false },
    { name: "Xi'an", coordinates: [108.9546, 34.2655], territoryId: "China", isCapital: false }, // Ancient capital
    { name: "Nanjing", coordinates: [118.7969, 32.0603], territoryId: "China", isCapital: false }, // Former capital
    { name: "Hong Kong", coordinates: [114.1694, 22.3193], territoryId: "China", isCapital: false },
    { name: "Tokyo", coordinates: [139.6917, 35.6895], territoryId: "Japan", isCapital: true },
    { name: "Kyoto", coordinates: [135.7681, 35.0116], territoryId: "Japan", isCapital: false }, // Imperial capital
    { name: "Seoul", coordinates: [126.9780, 37.5665], territoryId: "South Korea", isCapital: true },
    { name: "Pyongyang", coordinates: [125.7625, 39.0392], territoryId: "North Korea", isCapital: true },
    { name: "Taipei", coordinates: [121.5654, 25.0330], territoryId: "Taiwan", isCapital: true },
    { name: "Ulaanbaatar", coordinates: [106.9057, 47.8864], territoryId: "Mongolia", isCapital: true },

    // Asia - South & Southeast
    { name: "New Delhi", coordinates: [77.2090, 28.6139], territoryId: "India", isCapital: true },
    { name: "Mumbai", coordinates: [72.8777, 19.0760], territoryId: "India", isCapital: false },
    { name: "Kolkata", coordinates: [88.3639, 22.5726], territoryId: "India", isCapital: false },
    { name: "Varanasi", coordinates: [83.0100, 25.3176], territoryId: "India", isCapital: false }, // Ancient religious city
    { name: "Islamabad", coordinates: [73.0479, 33.6844], territoryId: "Pakistan", isCapital: true },
    { name: "Mohenjo-daro", coordinates: [68.1313, 27.3292], territoryId: "Pakistan", isCapital: false }, // Indus Valley city
    { name: "Dhaka", coordinates: [90.4125, 23.8103], territoryId: "Bangladesh", isCapital: true },
    { name: "Thimphu", coordinates: [89.6385, 27.4712], territoryId: "Bhutan", isCapital: true },
    { name: "Colombo", coordinates: [79.8612, 6.9271], territoryId: "Sri Lanka", isCapital: true },
    { name: "Singapore", coordinates: [103.8198, 1.3521], territoryId: "Singapore", isCapital: true },
    { name: "Bangkok", coordinates: [100.5018, 13.7563], territoryId: "Thailand", isCapital: true },
    { name: "Ayutthaya", coordinates: [100.5694, 14.3538], territoryId: "Thailand", isCapital: false }, // Former Siamese capital
    { name: "Jakarta", coordinates: [106.8650, -6.1751], territoryId: "Indonesia", isCapital: true },
    { name: "Hanoi", coordinates: [105.8342, 21.0278], territoryId: "Vietnam", isCapital: true },
    { name: "Angkor", coordinates: [103.8670, 13.4125], territoryId: "Cambodia", isCapital: false }, // Khmer Empire capital
    { name: "Phnom Penh", coordinates: [104.9282, 11.5564], territoryId: "Cambodia", isCapital: true },
    { name: "Manila", coordinates: [120.9842, 14.5995], territoryId: "Philippines", isCapital: true },
    { name: "Kathmandu", coordinates: [85.3240, 27.7172], territoryId: "Nepal", isCapital: true },
    { name: "Naypyidaw", coordinates: [96.1951, 19.7633], territoryId: "Myanmar", isCapital: true },
    { name: "Vientiane", coordinates: [102.6331, 17.9757], territoryId: "Laos", isCapital: true },
    { name: "Kuala Lumpur", coordinates: [101.6869, 3.1390], territoryId: "Malaysia", isCapital: true },
    { name: "Bandar Seri Begawan", coordinates: [114.9481, 4.9031], territoryId: "Brunei", isCapital: true },

    // Oceania
    { name: "Canberra", coordinates: [149.1300, -35.2809], territoryId: "Australia", isCapital: true },
    { name: "Sydney", coordinates: [151.2093, -33.8688], territoryId: "Australia", isCapital: false },
    { name: "Melbourne", coordinates: [144.9631, -37.8136], territoryId: "Australia", isCapital: false },
    { name: "Wellington", coordinates: [174.7762, -41.2865], territoryId: "New Zealand", isCapital: true },
    { name: "Port Moresby", coordinates: [147.1797, -9.4431], territoryId: "Papua New Guinea", isCapital: true },
    { name: "Suva", coordinates: [178.4419, -18.1416], territoryId: "Fiji", isCapital: true },
    { name: "Honiara", coordinates: [159.9555, -9.4333], territoryId: "Solomon Is.", isCapital: true },
    { name: "Port Vila", coordinates: [168.3219, -17.7344], territoryId: "Vanuatu", isCapital: true },
];

export function generateInitialGameState(mapData: MapData): GameState {
  const territories: { [id: string]: Territory } = {};
  const countries: { [name: string]: Country } = {};

  // FIX: Cast the result of TopoJSON.feature to `any` to access the `features` property.
  // The `feature` function returns a union type, but we know from the data structure
  // that it will be a FeatureCollection.
  // FIX: Corrected variable name from 'map' to 'mapData'.
  const worldFeatures = (TopoJSON.feature(mapData.world, mapData.world.objects.countries as any) as any).features;
  const usFeatures = (TopoJSON.feature(mapData.us, mapData.us.objects.states as any) as any).features;
  
  const allGeographies = [
    ...worldFeatures.map(f => ({ geo: f, type: 'world' })),
    ...usFeatures.map(f => ({ geo: f, type: 'us' })),
  ];

  allGeographies.forEach(({ geo, type }) => {
    let territoryId: string;
    let territoryName: string;
    let parentCountryName: string;

    if (type === 'us') {
      territoryId = `USA-${geo.id}`;
      territoryName = geo.properties.name;
      parentCountryName = "United States of America";
    } else {
      territoryId = geo.properties.name;
      territoryName = geo.properties.name;
      parentCountryName = geo.properties.name;
    }

    // Special handling for Antarctica
    if (parentCountryName === 'Antarctica') {
        territories[territoryId] = {
            id: territoryId,
            name: territoryName,
            parentCountryName: 'Unclaimed',
            owner: 'Unclaimed'
        };
        // Skip country creation for Antarctica
        return;
    }

    territories[territoryId] = {
      id: territoryId,
      name: territoryName,
      parentCountryName: parentCountryName,
      owner: parentCountryName
    };

    // If we haven't created this country yet, create it.
    if (!countries[parentCountryName] && parentCountryName && parentCountryName !== 'Unclaimed') {
      const name = parentCountryName;
      const realData = REAL_WORLD_DATA[name];
      const hash = simpleHash(name);

      countries[name] = {
        name,
        color: stringToColor(name),
        gdp: realData?.gdp ?? 10 + (hash % 200),
        population: realData?.population ?? 1 + (hash % 50),
        stability: realData?.stability ?? 30 + (hash % 60),
        resources: [],
        militaryStrength: realData?.militaryStrength ?? 10 + (hash % 40),
        militaryTech: realData?.militaryTech ?? 1 + (hash % 5),
      };
    }
  });

  const cities: City[] = INITIAL_CITIES.map(city => ({
    ...city,
    id: `${city.name}-${city.territoryId}`, // Create a unique ID
  }));

  return {
    territories,
    countries,
    cities,
    playerCountryName: null,
    year: 2024,
    events: [],
    chats: {},
  };
}
