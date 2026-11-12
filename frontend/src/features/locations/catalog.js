/**
 * Carefully curated Dhaka search seeds for fast, offline-first suggestions.
 * Names are NOT representations of approved TRIPPY boarding stops or exact GPS pins.
 * The approved-stop feed and optional MapTiler provider add verified coordinates.
 *
 * Format: English name | বাংলা name | category | broader search area | synonyms
 */
const AREA_ROWS = `
Banani|বনানী|area|Banani|bananee
Badda|বাড্ডা|area|Badda|bada
Banglamotor|বাংলামোটর|area|Banglamotor|bangla motor;bangla motor mor
Bashundhara Residential Area|বসুন্ধরা আবাসিক এলাকা|residential|Bashundhara|bashundhara r/a;bashundhara ra;bashundhara
Bailey Road|বেইলি রোড|road|Bailey Road|baily road;natok shoroni
Baridhara|বারিধারা|area|Baridhara|baridhara diplomatic zone
Baridhara DOHS|বারিধারা ডিওএইচএস|residential|Baridhara|baridhara dohs
Basabo|বাসাবো|area|Basabo|bashabo
Banasree|বনশ্রী|residential|Banasree|bonosree;banosree
Bonosree Block A|বনশ্রী ব্লক এ|residential|Banasree|
Bonosree Block B|বনশ্রী ব্লক বি|residential|Banasree|
Bonosree Block C|বনশ্রী ব্লক সি|residential|Banasree|
Bonosree Block D|বনশ্রী ব্লক ডি|residential|Banasree|
Banani DOHS|বনানী ডিওএইচএস|residential|Banani|
Banani Road 11|বনানী রোড ১১|road|Banani|banani 11;road no 11 banani
Banani Chairman Bari|বনানী চেয়ারম্যানবাড়ী|stop|Banani|chairman bari;chairmanbari
Banani Kakoli|বনানী কাকলী|stop|Banani|kakoli;banani kakoli
Bashundhara Gate|বসুন্ধরা গেট|stop|Bashundhara|bashundhara gate
Bashundhara City|বসুন্ধরা সিটি|landmark|Panthapath|bashundhara city shopping mall
Bashundhara Block A|বসুন্ধরা ব্লক এ|residential|Bashundhara|
Bashundhara Block B|বসুন্ধরা ব্লক বি|residential|Bashundhara|
Bashundhara Block C|বসুন্ধরা ব্লক সি|residential|Bashundhara|
Bangshal|বংশাল|area|Bangshal|bongshal
Babubazar|বাবুবাজার|area|Babubazar|babu bazar
Bakshibazar|বকশীবাজার|area|Bakshibazar|bokshi bazar
Bhairab Market|ভৈরব মার্কেট|landmark|Jatrabari|
Bijoy Sarani|বিজয় সরণি|area|Bijoy Sarani|bijoy shoroni;bijoy sarani
Bibir Bagicha|বিবির বাগিচা|area|Jatrabari|
Badda Link Road|বাড্ডা লিংক রোড|road|Badda|link road badda
North Badda|উত্তর বাড্ডা|area|Badda|uttor badda
Middle Badda|মধ্য বাড্ডা|area|Badda|moddho badda
South Badda|দক্ষিণ বাড্ডা|area|Badda|dokkhin badda
Merul Badda|মেরুল বাড্ডা|area|Badda|merul
Shahjadpur|শাহজাদপুর|area|Shahjadpur|shahjadpur badda
Nadda|নদ্দা|area|Nadda|noddha
Nikunja 1|নিকুঞ্জ ১|residential|Nikunja|nikunja one
Nikunja 2|নিকুঞ্জ ২|residential|Nikunja|nikunja two
Kuril|কুড়িল|area|Kuril|kuril bishwaroad
Kuril Bishwa Road|কুড়িল বিশ্বরোড|stop|Kuril|kuril biswaroad;kuril bishwaroad
Khilkhet|খিলক্ষেত|area|Khilkhet|khilkhet bazar
Kawla|কাওলা|area|Kawla|
Uttara|উত্তরা|area|Uttara|uttora
Uttara House Building|উত্তরা হাউস বিল্ডিং|stop|Uttara|housebuilding;uttara housebuilding
Uttara Rajlakshmi|উত্তরা রাজলক্ষ্মী|stop|Uttara|rajlokhi;rajlokkhi;rajlakshmi
Uttara Azampur|উত্তরা আজমপুর|stop|Uttara|azampur
Uttara Jasimuddin|উত্তরা জসীমউদ্দীন|stop|Uttara|jasimuddin;jasim uddin
Uttara Abdullahpur|উত্তরা আব্দুল্লাহপুর|stop|Uttara|abdullahpur
Uttara Diabari|উত্তরা দিয়াবাড়ি|area|Uttara|diabari
Uttara Lake Drive Road|উত্তরা লেক ড্রাইভ রোড|road|Uttara|
Uttara 3rd Phase|উত্তরা তৃতীয় পর্যায়|residential|Uttara|uttara third phase
Airport|বিমানবন্দর|area|Airport|dhaka airport;bimanbandar
Hazrat Shahjalal International Airport|হযরত শাহজালাল আন্তর্জাতিক বিমানবন্দর|landmark|Airport|dhaka airport;hsia
Airport Road|বিমানবন্দর সড়ক|road|Airport|airport road;dhaka airport road
Cantonment|ক্যান্টনমেন্ট|area|Cantonment|dhaka cantonment
Dhaka Cantonment|ঢাকা সেনানিবাস|area|Cantonment|cantonment
Kochukhet|কচুক্ষেত|area|Kochukhet|kachukhet
ECB Chattar|ইসিবি চত্বর|stop|Cantonment|ecb square
Matikata|মাটিকাটা|area|Matikata|matikata bazar
Kalshi|কালশী|area|Kalshi|kalshi mor
Pallabi|পল্লবী|area|Pallabi|pollobi
Mirpur|মিরপুর|area|Mirpur|
Mirpur 1|মিরপুর ১|area|Mirpur|mirpur one
Mirpur 2|মিরপুর ২|area|Mirpur|mirpur two
Mirpur 6|মিরপুর ৬|area|Mirpur|mirpur six
Mirpur 10|মিরপুর ১০|area|Mirpur|mirpur ten;mirpur 10 circle
Mirpur 11|মিরপুর ১১|area|Mirpur|mirpur eleven
Mirpur 12|মিরপুর ১২|area|Mirpur|mirpur twelve
Mirpur 13|মিরপুর ১৩|area|Mirpur|mirpur thirteen
Mirpur 14|মিরপুর ১৪|area|Mirpur|mirpur fourteen
Mirpur DOHS|মিরপুর ডিওএইচএস|residential|Mirpur|mirpur dohs
Mirpur Cantonment|মিরপুর সেনানিবাস|area|Mirpur|
Rupnagar|রূপনগর|residential|Mirpur|rupnogor
Pirerbag|পীরেরবাগ|area|Mirpur|pirer bag
Kazipara|কাজীপাড়া|area|Kazipara|kazi para
Shewrapara|শেওড়াপাড়া|area|Shewrapara|sheora para
Taltola Agargaon|তালতলা আগারগাঁও|area|Agargaon|taltola
Agargaon|আগারগাঁও|area|Agargaon|agar gaon
Shyamoli|শ্যামলী|area|Shyamoli|shamoli
Kallyanpur|কল্যাণপুর|area|Kallyanpur|kalyanpur
Gabtoli|গাবতলী|area|Gabtoli|gabtali
Technical Mor|টেকনিক্যাল মোড়|stop|Mirpur|technical;technical mor mirpur
Tolarbag|টোলারবাগ|area|Mirpur|
East Kazipara|পূর্ব কাজীপাড়া|area|Kazipara|
West Shewrapara|পশ্চিম শেওড়াপাড়া|area|Shewrapara|
Monipur|মনিপুর|area|Mirpur|monipur
Mohammadpur|মোহাম্মদপুর|area|Mohammadpur|mohammedpur
Mohammadpur Town Hall|মোহাম্মদপুর টাউন হল|stop|Mohammadpur|town hall mohammadpur
Lalmatia|লালমাটিয়া|residential|Lalmatia|
Adabor|আদাবর|area|Adabor|
Bosila|বসিলা|area|Bosila|basila
Babar Road|বাবর রোড|road|Mohammadpur|
Tajmahal Road|তাজমহল রোড|road|Mohammadpur|
Asad Gate|আসাদ গেট|stop|Mohammadpur|asadgate
Shankar|শংকর|area|Dhanmondi|shongkor
Rayer Bazar|রায়েরবাজার|area|Rayer Bazar|rayerbazar
Zigatola|জিগাতলা|area|Dhanmondi|jigatola
Dhanmondi|ধানমন্ডি|area|Dhanmondi|
Dhanmondi 27|ধানমন্ডি ২৭|road|Dhanmondi|dhanmondi road 27
Dhanmondi 32|ধানমন্ডি ৩২|road|Dhanmondi|dhanmondi road 32
Satmasjid Road|সাতমসজিদ রোড|road|Dhanmondi|shatmosjid road
Sukrabad|শুক্রাবাদ|area|Dhanmondi|
Kalabagan|কলাবাগান|area|Kalabagan|
Kolabagan|কলাবাগান|area|Kalabagan|kalabagan
Science Lab|সায়েন্স ল্যাব|stop|Science Lab|science laboratory;science lab mor
New Market|নিউ মার্কেট|area|New Market|newmarket
Gausia Market|গাউছিয়া মার্কেট|landmark|New Market|gausia
Elephant Road|এলিফ্যান্ট রোড|road|Elephant Road|
Nilkhet|নীলক্ষেত|area|Nilkhet|nilkhet mor
Katabon|কাঁটাবন|area|Katabon|kata bon
Shahbag|শাহবাগ|area|Shahbag|shahbagh
TSC Dhaka University|টিএসসি ঢাকা বিশ্ববিদ্যালয়|landmark|Shahbag|tsc
Dhaka University|ঢাকা বিশ্ববিদ্যালয়|landmark|Shahbag|du;university of dhaka
BUET|বুয়েট|landmark|Shahbag|bangladesh university of engineering and technology
Dhaka Medical College Hospital|ঢাকা মেডিকেল কলেজ হাসপাতাল|hospital|Shahbag|dmch;dhaka medical
Square Hospital|স্কয়ার হাসপাতাল|hospital|Panthapath|square hospital panthapath
Labaid Specialized Hospital|ল্যাবএইড হাসপাতাল|hospital|Dhanmondi|labaid dhanmondi
Evercare Hospital Dhaka|এভারকেয়ার হাসপাতাল ঢাকা|hospital|Bashundhara|evercare bashundhara
United Hospital Gulshan|ইউনাইটেড হাসপাতাল গুলশান|hospital|Gulshan|
Panthapath|পান্থপথ|road|Panthapath|panthopath
Green Road|গ্রিন রোড|road|Green Road|greenroad
Central Road|সেন্ট্রাল রোড|road|Dhanmondi|
Hatirpool|হাতিরপুল|area|Hatirpool|hatirpool bazar
Paribagh|পরীবাগ|area|Paribagh|
Farmgate|ফার্মগেট|area|Farmgate|farm gate
Indira Road|ইন্দিরা রোড|road|Farmgate|
Kawran Bazar|কারওয়ান বাজার|corporate|Kawran Bazar|karwan bazar;kawran bazar
Karwan Bazar|কারওয়ান বাজার|corporate|Kawran Bazar|kawran bazar
Tejgaon|তেজগাঁও|area|Tejgaon|
Tejgaon Industrial Area|তেজগাঁও শিল্প এলাকা|corporate|Tejgaon|tejgaon i/a;tejgaon industrial
Tejgaon Link Road|তেজগাঁও লিংক রোড|road|Tejgaon|
Nakhalpara|নাখালপাড়া|area|Tejgaon|nakhalpara
East Nakhalpara|পূর্ব নাখালপাড়া|area|Tejgaon|
West Nakhalpara|পশ্চিম নাখালপাড়া|area|Tejgaon|
Mohakhali|মহাখালী|area|Mohakhali|mohakhali
Mohakhali DOHS|মহাখালী ডিওএইচএস|residential|Mohakhali|mohakhali dohs
Mohakhali Wireless Gate|মহাখালী ওয়্যারলেস গেট|stop|Mohakhali|wireless gate
Mohakhali Bus Terminal|মহাখালী বাস টার্মিনাল|transit|Mohakhali|mohakhali terminal
Gulshan|গুলশান|area|Gulshan|
Gulshan 1|গুলশান ১|corporate|Gulshan|gulshan one;gulshan 1 circle
Gulshan 2|গুলশান ২|corporate|Gulshan|gulshan two;gulshan 2 circle
Gulshan Avenue|গুলশান অ্যাভিনিউ|road|Gulshan|gulshan ave
Gulshan Link Road|গুলশান লিংক রোড|road|Gulshan|
Gulshan Shooting Club|গুলশান শুটিং ক্লাব|landmark|Gulshan|shooting club
Police Plaza Concord|পুলিশ প্লাজা কনকর্ড|landmark|Gulshan|police plaza
Hatirjheel|হাতিরঝিল|area|Hatirjheel|haterjheel
Hatirjheel Link Road|হাতিরঝিল লিংক রোড|road|Hatirjheel|
Rampura|রামপুরা|area|Rampura|
West Rampura|পশ্চিম রামপুরা|area|Rampura|
East Rampura|পূর্ব রামপুরা|area|Rampura|
Rampura Bridge|রামপুরা ব্রিজ|stop|Rampura|
Aftabnagar|আফতাবনগর|residential|Aftabnagar|aftab nagar
Khilgaon|খিলগাঁও|area|Khilgaon|
Khilgaon Taltola|খিলগাঁও তালতলা|area|Khilgaon|
Khilgaon Railgate|খিলগাঁও রেলগেট|stop|Khilgaon|railgate khilgaon
Basabo Kadamtala|বাসাবো কদমতলা|area|Basabo|
Malibagh|মালিবাগ|area|Malibagh|
Malibagh Railgate|মালিবাগ রেলগেট|stop|Malibagh|malibagh rail gate
Mouchak|মৌচাক|area|Mouchak|mouchak mor
Moghbazar|মগবাজার|area|Moghbazar|mogbazar;mog bazar
Boro Moghbazar|বড় মগবাজার|area|Moghbazar|
Eskaton|ইস্কাটন|area|Eskaton|eskaton
New Eskaton|নিউ ইস্কাটন|area|Eskaton|
Bangla Academy|বাংলা একাডেমি|landmark|Shahbag|
Ramna|রমনা|area|Ramna|
Ramna Park|রমনা পার্ক|landmark|Ramna|
Kakrail|কাকরাইল|area|Kakrail|
Kakrail Mosque|কাকরাইল মসজিদ|landmark|Kakrail|
Segunbagicha|সেগুনবাগিচা|area|Segunbagicha|
Shantinagar|শান্তিনগর|area|Shantinagar|
Paltan|পল্টন|corporate|Paltan|
Purana Paltan|পুরানা পল্টন|corporate|Paltan|
Naya Paltan|নয়া পল্টন|area|Paltan|
Motijheel|মতিঝিল|corporate|Motijheel|
Motijheel Commercial Area|মতিঝিল বাণিজ্যিক এলাকা|corporate|Motijheel|motijheel ca
Dilkusha Commercial Area|দিলকুশা বাণিজ্যিক এলাকা|corporate|Dilkusha|dilkusha ca;dilkusha
Arambagh|আরামবাগ|area|Arambagh|
Fakirapool|ফকিরাপুল|area|Fakirapool|
Kamalapur|কমলাপুর|area|Kamalapur|
Kamalapur Railway Station|কমলাপুর রেলওয়ে স্টেশন|transit|Kamalapur|dhaka railway station
Shapla Chattar|শাপলা চত্বর|stop|Motijheel|shapla chottor
Baitul Mukarram|বায়তুল মোকাররম|landmark|Paltan|
Press Club|প্রেস ক্লাব|stop|Paltan|national press club
Bangladesh Secretariat|বাংলাদেশ সচিবালয়|corporate|Paltan|secretariat
Jatrabari|যাত্রাবাড়ী|area|Jatrabari|jatrabari
Sayedabad|সায়েদাবাদ|area|Sayedabad|saydabad
Sayedabad Bus Terminal|সায়েদাবাদ বাস টার্মিনাল|transit|Sayedabad|saydabad terminal
Shonir Akhra|শনির আখড়া|area|Jatrabari|shonir akhra
Kajla|কাজলা|area|Jatrabari|kajla jatrabari
Demra|ডেমরা|area|Demra|
Matuail|মাতুয়াইল|area|Jatrabari|
Rayerbag|রায়েরবাগ|area|Jatrabari|
Jurain|জুরাইন|area|Jurain|
Gandaria|গেন্ডারিয়া|area|Gandaria|gendaria
Sutrapur|সূত্রাপুর|area|Sutrapur|
Wari|ওয়ারী|area|Wari|
Tikatuli|টিকাটুলি|area|Tikatuli|
Dholaikhal|ধোলাইখাল|area|Dholaikhal|
Nawabpur Road|নবাবপুর রোড|road|Nawabpur|
Islampur|ইসলামপুর|area|Islampur|
Chawkbazar|চকবাজার|area|Chawkbazar|chawk bazar
Lalbagh|লালবাগ|area|Lalbagh|
Azimpur|আজিমপুর|area|Azimpur|
Hazaribagh|হাজারীবাগ|area|Hazaribagh|
Kamrangirchar|কামরাঙ্গীরচর|area|Kamrangirchar|
Postogola|পোস্তগোলা|area|Postogola|
Shyampur|শ্যামপুর|area|Shyampur|
Shakhari Bazar|শাঁখারীবাজার|area|Sutrapur|
Gulistan|গুলিস্তান|area|Gulistan|
Fulbaria|ফুলবাড়িয়া|area|Fulbaria|
Sadarghat|সদরঘাট|area|Sadarghat|sadarghat launch terminal
Sadarghat Launch Terminal|সদরঘাট লঞ্চ টার্মিনাল|transit|Sadarghat|
Dhaka New Market|ঢাকা নিউ মার্কেট|landmark|New Market|
Jamuna Future Park|যমুনা ফিউচার পার্ক|landmark|Bashundhara|jamuna mall;jfp
North South University|নর্থ সাউথ বিশ্ববিদ্যালয়|landmark|Bashundhara|nsu
Independent University Bangladesh|ইন্ডিপেনডেন্ট ইউনিভার্সিটি বাংলাদেশ|landmark|Bashundhara|iub
BRAC University|ব্র্যাক বিশ্ববিদ্যালয়|landmark|Merul Badda|bracu;brac university
AIUB|এআইইউবি|landmark|Kuril|american international university bangladesh
United International University|ইউনাইটেড ইন্টারন্যাশনাল ইউনিভার্সিটি|landmark|Badda|uiu
Ahsanullah University|আহছানউল্লা বিশ্ববিদ্যালয়|landmark|Tejgaon|aust
IDB Bhaban|আইডিবি ভবন|landmark|Agargaon|bcs computer city;idb
Bangladesh National Parliament|জাতীয় সংসদ ভবন|landmark|Sher-e-Bangla Nagar|jatiya sangsad;parliament
Sher-e-Bangla Nagar|শেরে বাংলা নগর|area|Sher-e-Bangla Nagar|
Chandrima Udyan|চন্দ্রিমা উদ্যান|landmark|Sher-e-Bangla Nagar|
National Museum|জাতীয় জাদুঘর|landmark|Shahbag|bangladesh national museum
Dhaka Zoo|ঢাকা চিড়িয়াখানা|landmark|Mirpur|national zoo
National Botanical Garden|জাতীয় উদ্ভিদ উদ্যান|landmark|Mirpur|
Mirpur Stadium|মিরপুর স্টেডিয়াম|landmark|Mirpur|sher e bangla cricket stadium
Mirpur 10 Circle|মিরপুর ১০ গোলচত্বর|stop|Mirpur|mirpur 10 gol chottor
Uttara North Metro Station|উত্তরা উত্তর মেট্রো স্টেশন|transit|Uttara|uttara north station
Uttara Center Metro Station|উত্তরা সেন্টার মেট্রো স্টেশন|transit|Uttara|uttara center station
Uttara South Metro Station|উত্তরা দক্ষিণ মেট্রো স্টেশন|transit|Uttara|uttara south station
Pallabi Metro Station|পল্লবী মেট্রো স্টেশন|transit|Pallabi|
Mirpur 11 Metro Station|মিরপুর ১১ মেট্রো স্টেশন|transit|Mirpur|
Mirpur 10 Metro Station|মিরপুর ১০ মেট্রো স্টেশন|transit|Mirpur|
Kazipara Metro Station|কাজীপাড়া মেট্রো স্টেশন|transit|Kazipara|
Shewrapara Metro Station|শেওড়াপাড়া মেট্রো স্টেশন|transit|Shewrapara|
Agargaon Metro Station|আগারগাঁও মেট্রো স্টেশন|transit|Agargaon|
Bijoy Sarani Metro Station|বিজয় সরণি মেট্রো স্টেশন|transit|Bijoy Sarani|
Farmgate Metro Station|ফার্মগেট মেট্রো স্টেশন|transit|Farmgate|
Karwan Bazar Metro Station|কারওয়ান বাজার মেট্রো স্টেশন|transit|Kawran Bazar|
Shahbag Metro Station|শাহবাগ মেট্রো স্টেশন|transit|Shahbag|
Dhaka University Metro Station|ঢাকা বিশ্ববিদ্যালয় মেট্রো স্টেশন|transit|Shahbag|
Bangladesh Secretariat Metro Station|বাংলাদেশ সচিবালয় মেট্রো স্টেশন|transit|Paltan|
Motijheel Metro Station|মতিঝিল মেট্রো স্টেশন|transit|Motijheel|
Airport Railway Station|বিমানবন্দর রেলস্টেশন|transit|Airport|airport train station
Tejgaon Railway Station|তেজগাঁও রেলস্টেশন|transit|Tejgaon|
Gandaria Railway Station|গেন্ডারিয়া রেলস্টেশন|transit|Gandaria|
Dhaka EPZ|ঢাকা ইপিজেড|corporate|Savar|dhaka export processing zone
Savar|সাভার|area|Savar|
Hemayetpur|হেমায়েতপুর|area|Savar|
Ashulia|আশুলিয়া|area|Ashulia|
Tongi|টঙ্গী|area|Tongi|
Uttarkhan|উত্তরখান|area|Uttarkhan|
Dakshinkhan|দক্ষিণখান|area|Dakshinkhan|
`;

const CATEGORY_LABELS = Object.freeze({
  area: ['Area', 'এলাকা'],
  residential: ['Residential', 'আবাসিক এলাকা'],
  corporate: ['Office district', 'অফিস এলাকা'],
  road: ['Road', 'সড়ক'],
  stop: ['Popular stop', 'পরিচিত স্টপ'],
  transit: ['Transport hub', 'পরিবহন কেন্দ্র'],
  landmark: ['Landmark', 'পরিচিত স্থান'],
  hospital: ['Hospital', 'হাসপাতাল'],
  approved: ['Approved pickup stop', 'অনুমোদিত স্টপ'],
  map: ['Map location', 'মানচিত্রের স্থান'],
});

const POPULAR = Object.freeze({
  banani:28, badda:26, 'bashundhara residential area':25,
  banglamotor:23, baridhara:20, banasree:19, 'bailey road':17,
  uttara:25, mirpur:23, dhanmondi:24, gulshan:23,
  motijheel:22, mohakhali:20, farmgate:19, shahbag:18,
  'kawran bazar':18, tejgaon:18, 'new market':17, 'kuril':17,
  jatrabari:16, shayamoli:14, pallabi:15, airport:18,
});
const popularity=place=>POPULAR[normalizePlaceQuery(place.name)]||0;

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';
const LATIN_DIGITS = '0123456789';
export const normalizePlaceQuery = text => String(text || '')
  .normalize('NFKC').toLowerCase()
  .replace(/[০-৯]/g, char => LATIN_DIGITS[BANGLA_DIGITS.indexOf(char)])
  .replace(/[\u200c\u200d]/g, '')
  .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

const rows = AREA_ROWS.trim().split('\n').map((row, index) => {
  const [name,bangla,category,zone,alias=''] = row.split('|');
  return Object.freeze({
    id: 'curated-'+index,
    name,
    bangla: bangla || name,
    category,
    zone: zone || name,
    aliases: alias ? alias.split(';') : [],
    source: 'curated',
    // No invented coordinates: the local index provides areas, not mapped GPS pins.
    latitude: null,
    longitude: null,
  });
});

for (let sector = 1; sector <= 18; sector++) {
  const banglaNumber = String(sector).replace(/\d/g, digit => BANGLA_DIGITS[Number(digit)]);
  rows.push(Object.freeze({
    id: 'uttara-sector-'+sector,
    name: 'Uttara Sector '+sector,
    bangla: 'উত্তরা সেক্টর '+banglaNumber,
    category: 'residential',
    zone: 'Uttara',
    aliases: ['sector '+sector+' uttara', 'uttara sec '+sector, 'উত্তরা সেক্টর '+sector],
    source: 'curated',
    latitude: null,
    longitude: null,
  }));
}
export const dhakaPlaces = Object.freeze(rows);
export const categoryLabel = (category, lang='en') =>
  (CATEGORY_LABELS[category] || CATEGORY_LABELS.area)[lang === 'bn' ? 1 : 0];

function editDistanceLimited(a,b,maxDistance){
  if(Math.abs(a.length-b.length)>maxDistance)return maxDistance+1;
  const previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const current=[i];
    for(let j=1;j<=b.length;j++){
      current[j]=Math.min(
        current[j-1]+1,previous[j]+1,
        previous[j-1]+(a[i-1]===b[j-1]?0:1)
      );
    }
    if(Math.min(...current)>maxDistance)return maxDistance+1;
    for(let j=0;j<current.length;j++)previous[j]=current[j];
  }
  return previous[b.length];
}

export function rankDhakaPlaces(query, places=dhakaPlaces, limit=8) {
  const q=normalizePlaceQuery(query);
  if(!q || q.length>100) return [];
  const result=[];
  for(const place of places) {
    const terms=[place.name,place.bangla,...(place.aliases||[])];
    let score=0;
    for(const term of terms){
      const normalized=normalizePlaceQuery(term);
      if(normalized===q) score=Math.max(score,130);
      else if(normalized.startsWith(q)) score=Math.max(score,112);
      else if(normalized.split(' ').some(x=>x.startsWith(q))) score=Math.max(score,85);
      else if(q.length>=3 && normalized.includes(q)) score=Math.max(score,57);
      else if(q.length>=4){
        // Slight spelling errors only; avoid noisy results for 1–3 characters.
        const threshold=q.length>=7?2:1;
        const candidates=normalized.split(' ').filter(t=>Math.abs(t.length-q.length)<=threshold);
        if(candidates.some(token=>editDistanceLimited(q,token,threshold)<=threshold)){
          score=Math.max(score,35);
        }
      }
    }
    if(!score) continue;
    score+=popularity(place);
    if(place.category==='area'||place.category==='corporate')score+=5;
    if(place.category==='stop'||place.category==='transit')score+=3;
    if(place.name.length<19) score+=3;
    result.push({place,score});
  }
  result.sort((a,b)=>b.score-a.score || a.place.name.localeCompare(b.place.name,'en',{numeric:true}));
  return result.slice(0,limit).map(x=>x.place);
}

export function mergeLocationSuggestions(query, {local=dhakaPlaces,approved=[],mapped=[],limit=8}={}){
  const coordsByName=new Map(mapped
    .filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude))
    .map(p=>[normalizePlaceQuery(p.name),p]));
  const enriched=rankDhakaPlaces(query,local,15).map(place=>{
    const coordinates=coordsByName.get(normalizePlaceQuery(place.name));
    return coordinates?{...place,latitude:coordinates.latitude,longitude:coordinates.longitude}:place;
  });
  const candidates=[...approved,...enriched,...mapped];
  const q=normalizePlaceQuery(query);
  const seen=new Set();
  const scored=[];
  for(const place of candidates){
    const name=String(place.name||'').trim();
    if(!name)continue;
    const key=normalizePlaceQuery(name);
    if(seen.has(key))continue;
    const matched=rankDhakaPlaces(q,[{...place,aliases:place.aliases||[]}],1).length;
    if(!matched)continue;
    seen.add(key);
    const prefix=key.startsWith(q);
    const sourceBoost=place.source==='approved'?35:place.source==='map'?8:0;
    const exact=key===q?30:0;
    scored.push({place,score:sourceBoost+exact+(prefix?20:0)+(name.length<20?3:0)+popularity(place)});
  }
  scored.sort((a,b)=>b.score-a.score||a.place.name.localeCompare(b.place.name));
  return scored.slice(0,limit).map(x=>x.place);
}
