/* Divorce Child Support Estimator — Donovan Legal PLLC divorce suite (2026-09-05)
 * Five states, each computed from its own statute or guidelines, with the data
 * tables reproduced from the primary source and dated. Then the tax layer the
 * guideline calculators do not show. Educational tool. Nothing entered leaves
 * the browser. Hard-navigated route; no inline scripts.
 *
 * ANNUAL REVIEW (the tool's "as of" line names these): Florida schedule
 * § 61.30(6) (legislature reviews every four years); New York cap / poverty /
 * self-support reserve (March 1 of even years; annual poverty figure);
 * Massachusetts chart (quadrennial; current: effective Dec. 1, 2025); Texas
 * cap (every six years; current: Sept. 1, 2025); California low-income
 * threshold (annual); federal child tax credit and brackets (annual).
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
  const pct = (n) => (Math.round((n || 0) * 1000) / 10).toFixed(1) + '%';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const numv = (id) => { const el = $(id); if (!el) return 0; const n = Number(String(el.value || '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const pctv = (id) => numv(id) / 100;

  /* ══ DATA — dated, from the primary sources ══════════════════════════════════ */
  const DATA = {
    asOf: 'September 5, 2026',
    // Fla. Stat. § 61.30(6), 2025 Florida Statutes: combined monthly net income → minimum support for 1–6 children.
    FL_SCHEDULE: [[800,190,211,213,216,218,220],[850,202,257,259,262,265,268],[900,213,302,305,309,312,315],[950,224,347,351,355,359,363],[1000,235,365,397,402,406,410],[1050,246,382,443,448,453,458],[1100,258,400,489,495,500,505],[1150,269,417,522,541,547,553],[1200,280,435,544,588,594,600],[1250,290,451,565,634,641,648],[1300,300,467,584,659,688,695],[1350,310,482,603,681,735,743],[1400,320,498,623,702,765,790],[1450,330,513,642,724,789,838],[1500,340,529,662,746,813,869],[1550,350,544,681,768,836,895],[1600,360,560,701,790,860,920],[1650,370,575,720,812,884,945],[1700,380,591,740,833,907,971],[1750,390,606,759,855,931,996],[1800,400,622,779,877,955,1022],[1850,410,638,798,900,979,1048],[1900,421,654,818,923,1004,1074],[1950,431,670,839,946,1029,1101],[2000,442,686,859,968,1054,1128],[2050,452,702,879,991,1079,1154],[2100,463,718,899,1014,1104,1181],[2150,473,734,919,1037,1129,1207],[2200,484,751,940,1060,1154,1234],[2250,494,767,960,1082,1179,1261],[2300,505,783,980,1105,1204,1287],[2350,515,799,1000,1128,1229,1314],[2400,526,815,1020,1151,1254,1340],[2450,536,831,1041,1174,1279,1367],[2500,547,847,1061,1196,1304,1394],[2550,557,864,1081,1219,1329,1420],[2600,568,880,1101,1242,1354,1447],[2650,578,896,1121,1265,1379,1473],[2700,588,912,1141,1287,1403,1500],[2750,597,927,1160,1308,1426,1524],[2800,607,941,1178,1328,1448,1549],[2850,616,956,1197,1349,1471,1573],[2900,626,971,1215,1370,1494,1598],[2950,635,986,1234,1391,1517,1622],[3000,644,1001,1252,1412,1540,1647],[3050,654,1016,1271,1433,1563,1671],[3100,663,1031,1289,1453,1586,1695],[3150,673,1045,1308,1474,1608,1720],[3200,682,1060,1327,1495,1631,1744],[3250,691,1075,1345,1516,1654,1769],[3300,701,1090,1364,1537,1677,1793],[3350,710,1105,1382,1558,1700,1818],[3400,720,1120,1401,1579,1723,1842],[3450,729,1135,1419,1599,1745,1867],[3500,738,1149,1438,1620,1768,1891],[3550,748,1164,1456,1641,1791,1915],[3600,757,1179,1475,1662,1814,1940],[3650,767,1194,1493,1683,1837,1964],[3700,776,1208,1503,1702,1857,1987],[3750,784,1221,1520,1721,1878,2009],[3800,793,1234,1536,1740,1899,2031],[3850,802,1248,1553,1759,1920,2053],[3900,811,1261,1570,1778,1940,2075],[3950,819,1275,1587,1797,1961,2097],[4000,828,1288,1603,1816,1982,2119],[4050,837,1302,1620,1835,2002,2141],[4100,846,1315,1637,1854,2023,2163],[4150,854,1329,1654,1873,2044,2185],[4200,863,1342,1670,1892,2064,2207],[4250,872,1355,1687,1911,2085,2229],[4300,881,1369,1704,1930,2106,2251],[4350,889,1382,1721,1949,2127,2273],[4400,898,1396,1737,1968,2147,2295],[4450,907,1409,1754,1987,2168,2317],[4500,916,1423,1771,2006,2189,2339],[4550,924,1436,1788,2024,2209,2361],[4600,933,1450,1804,2043,2230,2384],[4650,942,1463,1821,2062,2251,2406],[4700,951,1477,1838,2081,2271,2428],[4750,959,1490,1855,2100,2292,2450],[4800,968,1503,1871,2119,2313,2472],[4850,977,1517,1888,2138,2334,2494],[4900,986,1530,1905,2157,2354,2516],[4950,993,1542,1927,2174,2372,2535],[5000,1000,1551,1939,2188,2387,2551],[5050,1006,1561,1952,2202,2402,2567],[5100,1013,1571,1964,2215,2417,2583],[5150,1019,1580,1976,2229,2432,2599],[5200,1025,1590,1988,2243,2447,2615],[5250,1032,1599,2000,2256,2462,2631],[5300,1038,1609,2012,2270,2477,2647],[5350,1045,1619,2024,2283,2492,2663],[5400,1051,1628,2037,2297,2507,2679],[5450,1057,1638,2049,2311,2522,2695],[5500,1064,1647,2061,2324,2537,2711],[5550,1070,1657,2073,2338,2552,2727],[5600,1077,1667,2085,2352,2567,2743],[5650,1083,1676,2097,2365,2582,2759],[5700,1089,1686,2109,2379,2597,2775],[5750,1096,1695,2122,2393,2612,2791],[5800,1102,1705,2134,2406,2627,2807],[5850,1107,1713,2144,2418,2639,2820],[5900,1111,1721,2155,2429,2651,2833],[5950,1116,1729,2165,2440,2663,2847],[6000,1121,1737,2175,2451,2676,2860],[6050,1126,1746,2185,2462,2688,2874],[6100,1131,1754,2196,2473,2700,2887],[6150,1136,1762,2206,2484,2712,2900],[6200,1141,1770,2216,2495,2724,2914],[6250,1145,1778,2227,2506,2737,2927],[6300,1150,1786,2237,2517,2749,2941],[6350,1155,1795,2247,2529,2761,2954],[6400,1160,1803,2258,2540,2773,2967],[6450,1165,1811,2268,2551,2785,2981],[6500,1170,1819,2278,2562,2798,2994],[6550,1175,1827,2288,2573,2810,3008],[6600,1179,1835,2299,2584,2822,3021],[6650,1184,1843,2309,2595,2834,3034],[6700,1189,1850,2317,2604,2845,3045],[6750,1193,1856,2325,2613,2854,3055],[6800,1196,1862,2332,2621,2863,3064],[6850,1200,1868,2340,2630,2872,3074],[6900,1204,1873,2347,2639,2882,3084],[6950,1208,1879,2355,2647,2891,3094],[7000,1212,1885,2362,2656,2900,3103],[7050,1216,1891,2370,2664,2909,3113],[7100,1220,1897,2378,2673,2919,3123],[7150,1224,1903,2385,2681,2928,3133],[7200,1228,1909,2393,2690,2937,3142],[7250,1232,1915,2400,2698,2946,3152],[7300,1235,1921,2408,2707,2956,3162],[7350,1239,1927,2415,2716,2965,3172],[7400,1243,1933,2423,2724,2974,3181],[7450,1247,1939,2430,2733,2983,3191],[7500,1251,1945,2438,2741,2993,3201],[7550,1255,1951,2446,2750,3002,3211],[7600,1259,1957,2453,2758,3011,3220],[7650,1263,1963,2461,2767,3020,3230],[7700,1267,1969,2468,2775,3030,3240],[7750,1271,1975,2476,2784,3039,3250],[7800,1274,1981,2483,2792,3048,3259],[7850,1278,1987,2491,2801,3057,3269],[7900,1282,1992,2498,2810,3067,3279],[7950,1286,1998,2506,2818,3076,3289],[8000,1290,2004,2513,2827,3085,3298],[8050,1294,2010,2521,2835,3094,3308],[8100,1298,2016,2529,2844,3104,3318],[8150,1302,2022,2536,2852,3113,3328],[8200,1306,2028,2544,2861,3122,3337],[8250,1310,2034,2551,2869,3131,3347],[8300,1313,2040,2559,2878,3141,3357],[8350,1317,2046,2566,2887,3150,3367],[8400,1321,2052,2574,2895,3159,3376],[8450,1325,2058,2581,2904,3168,3386],[8500,1329,2064,2589,2912,3178,3396],[8550,1333,2070,2597,2921,3187,3406],[8600,1337,2076,2604,2929,3196,3415],[8650,1341,2082,2612,2938,3205,3425],[8700,1345,2088,2619,2946,3215,3435],[8750,1349,2094,2627,2955,3224,3445],[8800,1352,2100,2634,2963,3233,3454],[8850,1356,2106,2642,2972,3242,3464],[8900,1360,2111,2649,2981,3252,3474],[8950,1364,2117,2657,2989,3261,3484],[9000,1368,2123,2664,2998,3270,3493],[9050,1372,2129,2672,3006,3279,3503],[9100,1376,2135,2680,3015,3289,3513],[9150,1380,2141,2687,3023,3298,3523],[9200,1384,2147,2695,3032,3307,3532],[9250,1388,2153,2702,3040,3316,3542],[9300,1391,2159,2710,3049,3326,3552],[9350,1395,2165,2717,3058,3335,3562],[9400,1399,2171,2725,3066,3344,3571],[9450,1403,2177,2732,3075,3353,3581],[9500,1407,2183,2740,3083,3363,3591],[9550,1411,2189,2748,3092,3372,3601],[9600,1415,2195,2755,3100,3381,3610],[9650,1419,2201,2763,3109,3390,3620],[9700,1422,2206,2767,3115,3396,3628],[9750,1425,2210,2772,3121,3402,3634],[9800,1427,2213,2776,3126,3408,3641],[9850,1430,2217,2781,3132,3414,3647],[9900,1432,2221,2786,3137,3420,3653],[9950,1435,2225,2791,3143,3426,3659],[10000,1437,2228,2795,3148,3432,3666]],
    FL_OVER_10000: [0.05, 0.075, 0.095, 0.11, 0.12, 0.125],
    FL_POVERTY_MONTHLY: 15960 / 12,            // HHS 2026 poverty guideline, single person ($15,960)
    // New York CSSA (FCA § 413 / DRL § 240(1-b)); LDSS-4515 chart rev. 03/26.
    NY_CAP: 193000, NY_POVERTY: 15960, NY_SSR: 21546, NY_PCT: [0.17, 0.25, 0.29, 0.31, 0.35],
    // Massachusetts 2025 Child Support Guidelines (effective Dec. 1, 2025): weekly chart for ONE child;
    // "if available income falls between two numbers, use the lower support amount". Table B multipliers.
    MA_CHART: [[0,15],[304,16],[309,17],[314,18],[319,19],[324,20],[329,21],[334,22],[339,23],[344,24],[349,25],[354,26],[359,27],[364,28],[369,29],[374,30],[379,31],[384,32],[389,33],[392,86],[394,87],[398,88],[403,89],[407,90],[412,91],[416,92],[421,93],[425,94],[430,95],[435,96],[439,97],[444,98],[448,99],[453,100],[457,101],[462,102],[466,103],[471,104],[475,105],[480,106],[485,107],[489,108],[494,109],[498,110],[503,111],[507,112],[512,113],[516,114],[521,115],[525,116],[530,117],[535,118],[539,119],[544,120],[548,121],[553,122],[557,123],[562,124],[566,125],[571,126],[575,127],[580,128],[585,129],[589,130],[594,131],[598,132],[603,133],[607,134],[612,135],[616,136],[621,137],[625,138],[630,139],[635,140],[639,141],[644,142],[648,143],[653,144],[657,145],[662,146],[666,147],[671,148],[675,149],[680,150],[685,151],[689,152],[694,153],[698,154],[703,155],[707,156],[712,157],[716,158],[721,159],[725,160],[730,161],[735,162],[739,163],[744,164],[748,165],[753,166],[757,167],[762,168],[766,169],[771,170],[775,171],[780,172],[785,173],[789,174],[794,175],[798,176],[803,177],[807,178],[812,179],[816,180],[821,181],[825,182],[830,183],[835,184],[839,185],[844,186],[848,187],[853,188],[857,189],[862,190],[866,191],[871,192],[875,193],[880,194],[885,195],[889,196],[894,197],[898,198],[903,199],[907,200],[912,201],[916,202],[921,203],[925,204],[930,205],[935,206],[939,207],[944,208],[948,209],[953,210],[957,211],[962,212],[966,213],[971,214],[975,215],[980,216],[985,217],[989,218],[994,219],[998,220],[1003,221],[1008,222],[1012,223],[1017,224],[1022,225],[1027,226],[1031,227],[1036,228],[1041,229],[1046,230],[1050,231],[1055,232],[1060,233],[1065,234],[1070,235],[1074,236],[1079,237],[1084,238],[1089,239],[1093,240],[1098,241],[1103,242],[1108,243],[1112,244],[1117,245],[1122,246],[1127,247],[1131,248],[1136,249],[1141,250],[1146,251],[1150,252],[1155,253],[1160,254],[1165,255],[1170,256],[1174,257],[1179,258],[1184,259],[1189,260],[1193,261],[1198,262],[1203,263],[1208,264],[1212,265],[1217,266],[1222,267],[1227,268],[1231,269],[1236,270],[1241,271],[1246,272],[1250,273],[1255,274],[1260,275],[1265,276],[1270,277],[1274,278],[1279,279],[1284,280],[1289,281],[1293,282],[1298,283],[1303,284],[1308,285],[1312,286],[1317,287],[1322,288],[1327,289],[1331,290],[1336,291],[1341,292],[1346,293],[1350,294],[1355,295],[1360,296],[1365,297],[1370,298],[1374,299],[1379,300],[1384,301],[1389,302],[1393,303],[1398,304],[1403,305],[1408,306],[1412,307],[1417,308],[1422,309],[1427,310],[1431,311],[1436,312],[1441,313],[1446,314],[1450,315],[1455,316],[1460,317],[1465,318],[1470,319],[1474,320],[1479,321],[1484,322],[1489,323],[1493,324],[1498,325],[1503,326],[1508,327],[1512,328],[1517,329],[1522,330],[1527,331],[1531,332],[1536,333],[1541,334],[1546,335],[1550,336],[1555,337],[1560,338],[1565,339],[1570,340],[1574,341],[1579,342],[1584,343],[1589,344],[1593,345],[1598,346],[1603,347],[1609,348],[1614,349],[1620,350],[1625,351],[1631,352],[1637,353],[1642,354],[1648,355],[1653,356],[1659,357],[1664,358],[1670,359],[1675,360],[1681,361],[1687,362],[1692,363],[1698,364],[1703,365],[1709,366],[1714,367],[1720,368],[1725,369],[1731,370],[1737,371],[1742,372],[1748,373],[1753,374],[1759,375],[1764,376],[1770,377],[1775,378],[1781,379],[1787,380],[1792,381],[1798,382],[1803,383],[1809,384],[1814,385],[1820,386],[1825,387],[1831,388],[1837,389],[1842,390],[1848,391],[1853,392],[1859,393],[1864,394],[1870,395],[1875,396],[1881,397],[1887,398],[1892,399],[1898,400],[1903,401],[1909,402],[1914,403],[1920,404],[1925,405],[1931,406],[1937,407],[1942,408],[1948,409],[1953,410],[1959,411],[1964,412],[1970,413],[1975,414],[1981,415],[1987,416],[1992,417],[1998,418],[2003,419],[2009,420],[2014,421],[2020,422],[2025,423],[2031,424],[2037,425],[2042,426],[2048,427],[2053,428],[2059,429],[2064,430],[2070,431],[2075,432],[2081,433],[2087,434],[2092,435],[2098,436],[2103,437],[2109,438],[2114,439],[2120,440],[2125,441],[2131,442],[2137,443],[2142,444],[2148,445],[2153,446],[2159,447],[2164,448],[2170,449],[2175,450],[2181,451],[2187,452],[2192,453],[2198,454],[2203,455],[2209,456],[2214,457],[2220,458],[2225,459],[2231,460],[2237,461],[2242,462],[2248,463],[2253,464],[2259,465],[2264,466],[2270,467],[2275,468],[2281,469],[2287,470],[2292,471],[2298,472],[2303,473],[2309,474],[2314,475],[2320,476],[2325,477],[2331,478],[2337,479],[2342,480],[2348,481],[2353,482],[2359,483],[2364,484],[2370,485],[2375,486],[2381,487],[2387,488],[2392,489],[2398,490],[2404,491],[2411,492],[2418,493],[2425,494],[2433,495],[2440,496],[2447,497],[2454,498],[2461,499],[2468,500],[2475,501],[2483,502],[2490,503],[2497,504],[2504,505],[2511,506],[2518,507],[2525,508],[2533,509],[2540,510],[2547,511],[2554,512],[2561,513],[2568,514],[2575,515],[2583,516],[2590,517],[2597,518],[2604,519],[2611,520],[2618,521],[2625,522],[2633,523],[2640,524],[2647,525],[2654,526],[2661,527],[2668,528],[2675,529],[2683,530],[2690,531],[2697,532],[2704,533],[2711,534],[2718,535],[2725,536],[2733,537],[2740,538],[2747,539],[2754,540],[2761,541],[2768,542],[2775,543],[2783,544],[2790,545],[2797,546],[2804,547],[2811,548],[2818,549],[2825,550],[2833,551],[2840,552],[2847,553],[2854,554],[2861,555],[2868,556],[2875,557],[2883,558],[2890,559],[2897,560],[2904,561],[2911,562],[2918,563],[2925,564],[2933,565],[2940,566],[2947,567],[2954,568],[2961,569],[2968,570],[2975,571],[2983,572],[2990,573],[2997,574],[3004,575],[3011,576],[3018,577],[3025,578],[3033,579],[3040,580],[3047,581],[3054,582],[3061,583],[3068,584],[3075,585],[3083,586],[3090,587],[3097,588],[3104,589],[3111,590],[3118,591],[3125,592],[3133,593],[3140,594],[3147,595],[3154,596],[3161,597],[3168,598],[3175,599],[3183,600],[3190,601],[3197,602],[3204,603],[3211,604],[3218,605],[3225,606],[3225,606],[3233,607],[3240,608],[3247,609],[3254,610],[3261,611],[3268,612],[3275,613],[3283,614],[3290,615],[3297,616],[3304,617],[3311,618],[3318,619],[3325,620],[3333,621],[3340,622],[3347,623],[3354,624],[3361,625],[3368,626],[3375,627],[3383,628],[3390,629],[3397,630],[3404,631],[3411,632],[3418,633],[3425,634],[3433,635],[3440,636],[3447,637],[3454,638],[3461,639],[3468,640],[3475,641],[3483,642],[3490,643],[3497,644],[3505,645],[3514,646],[3523,647],[3532,648],[3541,649],[3550,650],[3560,651],[3569,652],[3578,653],[3587,654],[3596,655],[3605,656],[3614,657],[3623,658],[3632,659],[3641,660],[3650,661],[3660,662],[3669,663],[3678,664],[3687,665],[3696,666],[3705,667],[3714,668],[3723,669],[3732,670],[3741,671],[3750,672],[3760,673],[3769,674],[3778,675],[3787,676],[3796,677],[3805,678],[3814,679],[3823,680],[3832,681],[3841,682],[3850,683],[3860,684],[3869,685],[3878,686],[3887,687],[3896,688],[3905,689],[3914,690],[3923,691],[3932,692],[3941,693],[3950,694],[3960,695],[3969,696],[3978,697],[3987,698],[3996,699],[4005,700],[4014,701],[4023,702],[4032,703],[4041,704],[4050,705],[4060,706],[4069,707],[4078,708],[4087,709],[4096,710],[4105,711],[4114,712],[4123,713],[4132,714],[4141,715],[4150,716],[4160,717],[4169,718],[4178,719],[4187,720],[4196,721],[4205,722],[4214,723],[4223,724],[4232,725],[4241,726],[4250,727],[4260,728],[4269,729],[4278,730],[4287,731],[4296,732],[4305,733],[4314,734],[4323,735],[4332,736],[4341,737],[4350,738],[4360,739],[4369,740],[4378,741],[4387,742],[4396,743],[4405,744],[4414,745],[4423,746],[4432,747],[4441,748],[4450,749],[4460,750],[4469,751],[4478,752],[4487,753],[4496,754],[4505,755],[4514,756],[4523,757],[4532,758],[4541,759],[4550,760],[4560,761],[4569,762],[4578,763],[4587,764],[4596,765],[4605,766],[4614,767],[4623,768],[4632,769],[4641,770],[4650,771],[4660,772],[4669,773],[4678,774],[4687,775],[4696,776],[4705,777],[4714,778],[4723,779],[4732,780],[4741,781],[4750,782],[4760,783],[4769,784],[4778,785],[4787,786],[4796,787],[4805,788],[4814,789],[4823,790],[4832,791],[4841,792],[4850,793],[4860,794],[4869,795],[4878,796],[4887,797],[4896,798],[4905,799],[4914,800],[4923,801],[4932,802],[4941,803],[4950,804],[4960,805],[4969,806],[4978,807],[4987,808],[4996,809],[5005,810],[5015,811],[5025,812],[5035,813],[5045,814],[5055,815],[5065,816],[5075,817],[5085,818],[5095,819],[5105,820],[5115,821],[5125,822],[5135,823],[5145,824],[5155,825],[5165,826],[5175,827],[5185,828],[5195,829],[5205,830],[5215,831],[5225,832],[5235,833],[5245,834],[5255,835],[5265,836],[5275,837],[5285,838],[5295,839],[5305,840],[5315,841],[5325,842],[5335,843],[5345,844],[5355,845],[5365,846],[5375,847],[5385,848],[5395,849],[5405,850],[5415,851],[5425,852],[5435,853],[5445,854],[5455,855],[5465,856],[5475,857],[5485,858],[5495,859],[5505,860],[5515,861],[5525,862],[5535,863],[5545,864],[5555,865],[5565,866],[5575,867],[5585,868],[5595,869],[5605,870],[5615,871],[5625,872],[5635,873],[5645,874],[5655,875],[5665,876],[5675,877],[5685,878],[5695,879],[5705,880],[5715,881],[5725,882],[5735,883],[5745,884],[5755,885],[5765,886],[5775,887],[5785,888],[5795,889],[5805,890],[5815,891],[5825,892],[5835,893],[5845,894],[5855,895],[5865,896],[5875,897],[5885,898],[5895,899],[5905,900],[5915,901],[5925,902],[5935,903],[5945,904],[5955,905],[5965,906],[5975,907],[5985,908],[5995,909],[6005,910],[6015,911],[6025,912],[6035,913],[6045,914],[6055,915],[6065,916],[6075,917],[6085,918],[6095,919],[6105,920],[6115,921],[6125,922],[6135,923],[6145,924],[6155,925],[6165,926],[6175,927],[6185,928],[6195,929],[6205,930],[6215,931],[6225,932],[6235,933],[6245,934],[6255,935],[6265,936],[6275,937],[6285,938],[6295,939],[6305,940],[6315,941],[6325,942],[6335,943],[6345,944],[6355,945],[6365,946],[6375,947],[6385,948],[6395,949],[6405,950],[6415,951],[6425,952],[6435,953],[6445,954],[6455,955],[6465,956],[6475,957],[6485,958],[6495,959],[6505,960],[6515,961],[6525,962],[6535,963],[6545,964],[6555,965],[6565,966],[6575,967],[6585,968],[6595,969],[6605,970],[6615,971],[6625,972],[6635,973],[6645,974],[6655,975],[6665,976],[6675,977],[6685,978],[6695,979],[6705,980],[6715,981],[6725,982],[6735,983],[6745,984],[6755,985],[6765,986],[6775,987],[6785,988],[6795,989],[6805,990],[6815,991],[6825,992],[6835,993],[6845,994],[6855,995],[6865,996],[6875,997],[6885,998],[6895,999],[6905,1000],[6915,1001],[6925,1002],[6935,1003],[6945,1004],[6955,1005],[6965,1006],[6975,1007],[6985,1008],[6995,1009],[7015,1011],[7025,1012],[7035,1013],[7045,1014],[7055,1015],[7065,1016],[7075,1017],[7085,1018],[7095,1019],[7105,1020],[7115,1021],[7125,1022],[7135,1023],[7145,1024],[7155,1025],[7165,1026],[7175,1027],[7185,1028],[7195,1029],[7205,1030],[7215,1031],[7225,1032],[7235,1033],[7245,1034],[7255,1035],[7265,1036],[7275,1037],[7285,1038],[7295,1039],[7305,1040],[7315,1041],[7325,1042],[7335,1043],[7345,1044],[7355,1045],[7365,1046],[7375,1047],[7385,1048],[7395,1049],[7405,1050],[7415,1051],[7425,1052],[7435,1053],[7445,1054],[7465,1056],[7475,1057],[7485,1058],[7495,1059],[7505,1060],[7515,1061],[7525,1062],[7535,1063],[7545,1064],[7555,1065],[7565,1066],[7575,1067],[7585,1068],[7595,1069],[7605,1070],[7615,1071],[7625,1072],[7635,1073],[7645,1074],[7655,1075],[7665,1076],[7675,1077],[7685,1078],[7695,1079],[7705,1080],[7715,1081],[7725,1082],[7735,1083],[7745,1084],[7755,1085],[7765,1086],[7775,1087],[7785,1088],[7795,1089],[7805,1090],[7815,1091],[7825,1092],[7835,1093],[7845,1094],[7855,1095],[7865,1096],[7875,1097],[7885,1098],[7895,1099],[7915,1101],[7925,1102],[7935,1103],[7945,1104],[7955,1105],[7965,1106],[7975,1107],[7985,1108],[7995,1109],[8005,1110],[8015,1111],[8025,1112],[8035,1113],[8045,1114],[8055,1115],[8065,1116],[8075,1117],[8085,1118],[8095,1119],[8105,1120],[8115,1121],[8125,1122],[8135,1123],[8145,1124],[8155,1125],[8165,1126],[8175,1127],[8185,1128],[8195,1129],[8205,1130],[8215,1131],[8225,1132],[8235,1133],[8245,1134],[8255,1135],[8265,1136],[8275,1137],[8285,1138],[8295,1139],[8305,1140],[8315,1141],[8325,1142],[8335,1143],[8345,1144],[8365,1146],[8375,1147],[8385,1148],[8395,1149],[8405,1150],[8415,1151],[8425,1152],[8435,1153],[8445,1154],[8455,1155],[8465,1156],[8475,1157],[8485,1158],[8495,1159],[8505,1160],[8515,1161],[8525,1162],[8535,1163],[8545,1164],[8555,1165],[8565,1166],[8575,1167],[8585,1168],[8595,1169],[8605,1170],[8615,1171],[8625,1172],[8635,1173],[8654,1174]],
    MA_TABLE_B: [1, 1.40, 1.68, 1.85, 1.94], MA_MAX_WEEKLY: 8654, MA_SELF_SUPPORT_WEEKLY: 391, MA_CHILDCARE_CAP_WEEKLY: 430,
    // Texas Fam. Code § 154.125 (cap adjusted Sept. 1, 2025) and § 154.129 (multiple-family table).
    TX_CAP: 11700, TX_PCT: [0.20, 0.25, 0.30, 0.35, 0.40], TX_LOW_PCT: [0.15, 0.20, 0.25, 0.30, 0.35],
    TX_MULTI: [[20, 25, 30, 35, 40], [17.50, 22.50, 27.38, 32.20, 37.33], [16.00, 20.63, 25.20, 30.33, 35.43], [14.75, 19.00, 24.00, 29.00, 34.00], [13.60, 18.33, 23.14, 28.00, 32.89], [13.33, 17.86, 22.50, 27.22, 32.00], [13.14, 17.50, 22.00, 26.60, 31.27], [13.00, 17.22, 21.60, 26.09, 30.67]],
    // California Fam. Code § 4055.
    CA_MULT: [1, 1.6, 2, 2.3, 2.5, 2.625, 2.75, 2.813, 2.844, 2.86],
    // Federal 2026 (single filer) for the net-income estimates and the tax layer.
    FED_ORD: [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [Infinity, .37]],
    FED_STD_SINGLE: 16100, FED_STD_HOH: 24150, FICA_WAGE_BASE: 184500, CTC: 2200, CTC_PHASEOUT_SINGLE: 200000,
  };

  /* ══ Helpers ═══════════════════════════════════════════════════════════════ */
  function fedTax(taxable) { let t = 0, prev = 0; for (const [cap, r] of DATA.FED_ORD) { if (taxable <= prev) break; t += (Math.min(taxable, cap) - prev) * r; prev = cap; } return Math.max(0, t); }
  function fica(gross) { return Math.min(gross, DATA.FICA_WAGE_BASE) * 0.062 + gross * 0.0145; }
  function estNetMonthly(grossAnnual, stateRate) { const tax = fedTax(Math.max(0, grossAnnual - DATA.FED_STD_SINGLE)) + fica(grossAnnual) + grossAnnual * (stateRate || 0); return Math.max(0, grossAnnual - tax) / 12; }
  function flLookup(combinedMonthly, kids) {
    const k = Math.min(6, Math.max(1, kids));
    if (combinedMonthly < 800) return { base: null, below: true };
    if (combinedMonthly > 10000) { const row = DATA.FL_SCHEDULE[DATA.FL_SCHEDULE.length - 1]; return { base: row[k] + DATA.FL_OVER_10000[k - 1] * (combinedMonthly - 10000), over: true }; }
    let row = DATA.FL_SCHEDULE[0];
    for (const r of DATA.FL_SCHEDULE) { if (r[0] <= combinedMonthly) row = r; else break; }   // schedule row at or below income
    return { base: row[k] };
  }
  function maLookup(weekly) { let v = 15; for (const [inc, amt] of DATA.MA_CHART) { if (inc <= weekly) v = amt; else break; } return v; }

  /* ══ State computations ════════════════════════════════════════════════════ */
  const J = {
    FL: {
      name: 'Florida', cite: 'Fla. Stat. § 61.30 (2025)', dataNote: 'Schedule: § 61.30(6), 2025 Florida Statutes. Poverty guideline: HHS 2026, single person, $15,960.',
      summary: 'Income-shares model. Each parent\u2019s monthly NET income (gross from all sources, less federal, state and local income tax, FICA or self-employment tax, mandatory union dues and retirement, health insurance other than the child\u2019s, and court-ordered support actually paid) is combined; the § 61.30(6) schedule gives the minimum need for the number of children; each parent bears a share in proportion to net income. Above $10,000 of combined net income the schedule amount is increased by 5% / 7.5% / 9.5% / 11% / 12% / 12.5% of the excess for one to six children. Work-related child care and the child\u2019s health insurance are added to the basic obligation and shared the same way. Where each parent has the child at least 20% of the overnights, the gross-up method of § 61.30(11)(b) applies: each parent\u2019s share is multiplied by 1.5, then by the other parent\u2019s share of overnights, and the difference is the transfer. The court may vary the result by 5% without findings and further only on written findings; a payor whose payment would leave less than the poverty guideline pays the lesser of the share or 90% of the excess over the guideline. Income is imputed to a voluntarily unemployed or underemployed parent.',
      compute(i) {
        const kids = Math.min(6, Math.max(1, i.kids));
        const A = i.netA, B = i.netB, comb = A + B;
        const lk = flLookup(comb, kids);
        if (lk.below) return { monthly: 0, payor: 'B', basis: 'Combined monthly net income is below $800, the bottom of the schedule; § 61.30(6)(a) directs a case-by-case amount that establishes the principle of payment.', lines: [] };
        const shareA = comb ? A / comb : 0.5, shareB = 1 - shareA;
        const addons = i.childcare + i.health;
        const total = lk.base + addons;
        const lines = [['Combined monthly net income', money(comb)], ['Schedule amount for ' + kids + (kids === 1 ? ' child' : ' children') + (lk.over ? ' (schedule at $10,000 plus the percentage of the excess)' : ''), money(lk.base)], ['Child care + health insurance added', money(addons)], ['Total minimum need', money(total)], ['Share A / Share B', pct(shareA) + ' / ' + pct(shareB)]];
        let transfer, payor, method;
        const substantial = i.overnightsB > 0 && i.overnightsB >= 0.20 && (1 - i.overnightsB) >= 0.20;
        if (substantial) {
          const gA = lk.base * shareA * 1.5, gB = lk.base * shareB * 1.5;
          const oA = gA * i.overnightsB, oB = gB * (1 - i.overnightsB);      // each parent's obligation × the OTHER parent's overnights
          const net = oA - oB;                                              // positive: A pays B
          // add-ons: each parent's share of day care + health, credited for what each actually pays
          const aOwes = addons * shareA - i.paidByA, bOwes = addons * shareB - (addons - i.paidByA);
          transfer = net + (aOwes - bOwes) / 2 * 0; // add-on netting handled below for clarity
          const addonNet = (addons * shareA - i.paidByA) - (addons * shareB - (addons - i.paidByA));
          transfer = net + addonNet / 2;
          payor = transfer >= 0 ? 'A' : 'B'; transfer = Math.abs(transfer);
          method = 'Substantial time-sharing (each parent at least 20% of overnights): § 61.30(11)(b) gross-up. A\u2019s obligation ' + money(gA) + ' × B\u2019s overnights ' + pct(i.overnightsB) + ' = ' + money(oA) + '; B\u2019s obligation ' + money(gB) + ' × A\u2019s overnights ' + pct(1 - i.overnightsB) + ' = ' + money(oB) + '; difference ' + money(Math.abs(net)) + ', then netted for who actually pays the child care and insurance.';
        } else {
          // primary residence with one parent: the other pays their share, credited for add-ons they pay directly
          const custodialA = i.overnightsB < 0.5;                     // A has the majority of overnights
          const obligor = custodialA ? 'B' : 'A';
          const obligorShare = custodialA ? shareB : shareA;
          const obligorPaid = custodialA ? (addons - i.paidByA) : i.paidByA;
          transfer = Math.max(0, total * obligorShare - obligorPaid);
          payor = obligor;
          method = 'Primary residence with ' + (custodialA ? 'A' : 'B') + ': ' + obligor + ' pays ' + pct(obligorShare) + ' of the total need (' + money(total * obligorShare) + '), less the add-ons ' + obligor + ' pays directly (' + money(obligorPaid) + ').';
          // low-income obligor
          const obligorNet = obligor === 'A' ? A : B;
          const ceiling = 0.90 * (obligorNet - DATA.FL_POVERTY_MONTHLY);
          if (obligorNet < 10000 && transfer > ceiling) { transfer = Math.max(0, ceiling); method += ' Low-income rule (§ 61.30(6)(a)2.): capped at 90% of net income over the poverty guideline (' + money(DATA.FL_POVERTY_MONTHLY) + '/mo).'; }
        }
        return { monthly: transfer, payor, basis: method, lines, band: [transfer * 0.95, transfer * 1.05] };
      },
    },
    NY: {
      name: 'New York', cite: 'Family Court Act § 413; DRL § 240(1-b)', dataNote: 'Cap $193,000, poverty $15,960, self-support reserve $21,546 — LDSS-4515 chart rev. 03/26, effective March 1, 2026; cap adjusted every two years.',
      summary: 'Percentage-of-income model on COMBINED parental income up to the cap. \u201cIncome\u201d is gross income as it would be reported on the federal return, plus imputed items, less FICA and New York City or Yonkers income tax and support actually paid for other children (federal and state income tax and 401(k) deferrals are NOT deducted). The basic obligation is 17% / 25% / 29% / 31% / no less than 35% of combined income for one to five or more children, pro-rated between the parents by income. Above the cap the court may apply the percentages, the statutory factors, or both. Work-related child care, the child\u2019s health insurance premium and unreimbursed medical expenses are added pro rata. Low-income rules: if the non-custodial parent\u2019s income is below the poverty guideline the order is $25 per month; if below the self-support reserve, the greater of $50 per month or income less the reserve. Support runs to age 21. The court may deviate on the paragraph (f) factors where the formula is unjust or inappropriate.',
      compute(i) {
        const kids = Math.max(1, i.kids); const p = DATA.NY_PCT[Math.min(4, kids - 1)];
        const incA = Math.max(0, i.grossA - fica(i.grossA) - i.nycTaxA), incB = Math.max(0, i.grossB - fica(i.grossB) - i.nycTaxB);
        const comb = incA + incB; const capped = Math.min(comb, i.nyCap || DATA.NY_CAP);
        const basic = capped * p; const shareA = comb ? incA / comb : 0.5;
        const custodialA = i.overnightsB < 0.5; const ncp = custodialA ? 'B' : 'A'; const ncpShare = custodialA ? 1 - shareA : shareA; const ncpIncome = custodialA ? incB : incA;
        let annual = basic * ncpShare; let note = '';
        const addonsAnnual = (i.childcare + i.health) * 12; const ncpAddons = addonsAnnual * ncpShare;
        if (ncpIncome - annual < DATA.NY_POVERTY) { annual = 300; note = ' Low-income: NCP income after support would be below the poverty guideline; basic obligation $25/mo.'; }
        else if (ncpIncome - annual < DATA.NY_SSR) { annual = Math.max(600, ncpIncome - DATA.NY_SSR); note = ' Low-income: below the self-support reserve; greater of $50/mo or income less the reserve.'; }
        const monthly = (annual + ncpAddons) / 12;
        const lines = [['CSSA income A / B (gross less FICA' + (i.nycTaxA || i.nycTaxB ? ' and NYC/Yonkers tax' : '') + ')', money(incA) + ' / ' + money(incB)], ['Combined income', money(comb) + (comb > (i.nyCap || DATA.NY_CAP) ? ' (formula applied to the ' + money(i.nyCap || DATA.NY_CAP) + ' cap; ' + money(comb - (i.nyCap || DATA.NY_CAP)) + ' above the cap is discretionary)' : '')], ['Basic obligation ' + pct(p) + ' × capped income', money(basic) + '/yr'], ['Non-custodial parent ' + ncp + '\u2019s share', pct(ncpShare) + ' = ' + money(basic * ncpShare) + '/yr'], ['Add-ons (child care, health premium) pro rata', money(ncpAddons) + '/yr']];
        return { monthly, payor: ncp, basis: 'CSSA percentage on combined income up to the cap, pro-rated by income; add-ons pro rata.' + note + (comb > (i.nyCap || DATA.NY_CAP) ? ' The court may apply the percentage to some or all income above the cap under Cassano v. Cassano, 85 N.Y.2d 649 (1995), on articulated reasons.' : ''), lines };
      },
    },
    MA: {
      name: 'Massachusetts', cite: 'Massachusetts Child Support Guidelines (Trial Court, effective December 1, 2025); M.G.L. c. 208, § 28', dataNote: '2025 Child Support Guidelines Chart, weekly amounts for one child (Table A), and Table B multipliers 1.40 / 1.68 / 1.85 / 1.94; maximum combined available income $450,000 ($8,654/week); minimum orders $15 (income to $301/wk) and up to $33 ($302\u2013$391/wk).',
      summary: 'Income-shares model run on WEEKLY GROSS income (\u201cavailable income\u201d after deducting the cost of health, dental and vision coverage actually paid and support for other children). The chart gives the basic order for one child from the parents\u2019 combined available income; Table B multiplies it for two to five children (1.40, 1.68, 1.85, 1.94; six or more at least the five-child amount). Child care actually paid, up to $430 per week per child, and the children\u2019s health/dental/vision costs are shared in proportion to income. With a primary-residence plan (about two-thirds / one-third) the payor pays its share of the combined amount; with shared, approximately equal time and financial responsibility the worksheet runs the calculation both ways and the higher earner pays the difference. If the payor\u2019s own available income is $391 a week or less, the order comes from the shaded low-income region of the chart regardless of the recipient\u2019s income. Combined income above $450,000 is at the court\u2019s discretion, with the $450,000 figure the presumptive minimum. Where both alimony and child support are in play, Cavanagh v. Cavanagh, 490 Mass. 398 (2022), requires the court to run alimony-first and child-support-first and pick the more equitable result. A 40%-of-income order is a presumptive hardship justifying deviation.',
      compute(i) {
        const kids = Math.max(1, i.kids); const mult = DATA.MA_TABLE_B[Math.min(4, kids - 1)];
        const wA = Math.max(0, (i.grossA - i.healthDeductA * 12) / 52), wB = Math.max(0, (i.grossB - i.healthDeductB * 12) / 52);
        const comb = wA + wB; const combCapped = Math.min(comb, DATA.MA_MAX_WEEKLY);
        const shareA = comb ? wA / comb : 0.5;
        const custodialA = i.overnightsB < 0.5; const payor = i.shared ? (wA >= wB ? 'A' : 'B') : (custodialA ? 'B' : 'A');
        const payorWeekly = payor === 'A' ? wA : wB;
        const ccWeekly = Math.min(i.childcare * 12 / 52, DATA.MA_CHILDCARE_CAP_WEEKLY * kids) + i.health * 12 / 52;
        let weekly, method;
        if (payorWeekly <= DATA.MA_SELF_SUPPORT_WEEKLY) {
          weekly = maLookup(payorWeekly) * mult; method = 'Payor\u2019s own available income is in the low-income region of the chart ($' + Math.round(payorWeekly) + '/week); the chart amount for that income (' + money(maLookup(payorWeekly)) + ' × ' + mult + ' for ' + kids + ') applies regardless of the recipient\u2019s income, with no add-ons.';
        } else if (i.shared) {
          // shared: each parent as payor of the other's share, higher earner pays the difference
          const base = maLookup(combCapped) * mult; const combined = base + ccWeekly;
          const asA = combined * shareA, asB = combined * (1 - shareA);
          weekly = Math.abs(asA - asB); method = 'Shared parenting (approximately equal time and financial responsibility): combined support ' + money(combined) + '/week (chart ' + money(maLookup(combCapped)) + ' × ' + mult + ' + shared costs ' + money(ccWeekly) + '); A\u2019s share ' + money(asA) + ', B\u2019s ' + money(asB) + '; the higher earner pays the difference.';
        } else {
          const base = maLookup(combCapped) * mult; const combined = base + ccWeekly; const payorShare = payor === 'A' ? shareA : 1 - shareA;
          weekly = combined * payorShare; method = 'Primary residence with ' + (custodialA ? 'A' : 'B') + ': chart amount for combined available income ' + money(Math.round(combCapped)) + '/week is ' + money(maLookup(combCapped)) + ' for one child × ' + mult + ' = ' + money(base) + '; plus shared child care and health costs ' + money(ccWeekly) + '; ' + payor + ' pays ' + pct(payorShare) + '.';
        }
        const hardship = payorWeekly > 0 && weekly / payorWeekly >= 0.40;
        const lines = [['Available income A / B (weekly)', money(Math.round(wA)) + ' / ' + money(Math.round(wB))], ['Combined available income (weekly)', money(Math.round(comb)) + (comb > DATA.MA_MAX_WEEKLY ? ' (guidelines applied to the $8,654 maximum; the excess is discretionary)' : '')], ['Chart amount, one child, at combined income', money(maLookup(combCapped)) + '/week'], ['Table B multiplier for ' + kids, String(mult)], ['Weekly order', money(weekly)]];
        return { monthly: weekly * 52 / 12, payor, basis: method + (hardship ? ' The order is 40% or more of the payor\u2019s available income: a rebuttable presumption of substantial hardship justifying deviation (Section IV. C.).' : ''), lines, weekly };
      },
    },
    CA: {
      name: 'California', cite: 'Cal. Fam. Code §§ 4050\u20134076 (statewide uniform guideline, § 4055)', dataNote: 'Statutory formula and multipliers, Fam. Code § 4055; low-income adjustment threshold is indexed annually (§ 4055(b)(7)) \u2014 enter the current figure.',
      summary: 'Algebraic statewide formula, presumptively correct and rebuttable only on the § 4057 findings: CS = K × [HN \u2212 (H%) × TN], where HN is the higher earner\u2019s NET disposable income, TN is both parents\u2019 total net disposable income, H% is the higher earner\u2019s approximate share of time with the child, and K is the fraction of income allocated to support: (1 + H%) × 0.25 for total net income of $801\u2013$6,666 a month, (1 + H%) × (0.10 + 1000/TN) for $6,667\u2013$10,000, (1 + H%) × (0.12 + 800/TN) above $10,000 (and (2 \u2212 H%) in place of (1 + H%) when the higher earner has more than half the time). The one-child amount is multiplied by 1.6, 2, 2.3, 2.5 \u2026 for two, three, four, five children. Net disposable income is gross less actual federal and state tax, FICA, mandatory retirement and union dues, health premiums, and support for other children (§ 4059) \u2014 the DissoMaster / court-calculator layer. Mandatory add-ons shared equally (or by income on request): child care for employment and uninsured health costs (§ 4062). A low-income adjustment applies below the indexed threshold. Timeshare is the single most litigated input; a percentage point of time moves the number.',
      compute(i) {
        const kids = Math.max(1, i.kids); const mult = DATA.CA_MULT[Math.min(9, kids - 1)];
        const nA = i.netA, nB = i.netB; const TN = nA + nB;
        const hiA = nA >= nB; const HN = hiA ? nA : nB; const Hpct = hiA ? (1 - i.overnightsB) : i.overnightsB;   // higher earner's time share
        let frac; if (TN <= 800) frac = 0.20 + TN / 16000; else if (TN <= 6666) frac = 0.25; else if (TN <= 10000) frac = 0.10 + 1000 / TN; else frac = 0.12 + 800 / TN;
        const K = (Hpct <= 0.5 ? (1 + Hpct) : (2 - Hpct)) * frac;
        const cs1 = K * (HN - Hpct * TN); const cs = cs1 * mult;
        const payor = cs >= 0 ? (hiA ? 'A' : 'B') : (hiA ? 'B' : 'A');
        const addonsEach = (i.childcare + i.health) / 2;
        const lines = [['Net disposable income A / B (monthly)', money(nA) + ' / ' + money(nB)], ['Higher earner\u2019s net (HN) / total (TN)', money(HN) + ' / ' + money(TN)], ['Higher earner\u2019s time share (H%)', pct(Hpct)], ['K factor', K.toFixed(4) + ' = ' + (Hpct <= 0.5 ? '(1 + H%)' : '(2 \u2212 H%)') + ' × ' + frac.toFixed(4)], ['One-child guideline CS = K × [HN \u2212 H% × TN]', money(Math.abs(cs1))], ['× multiplier for ' + kids + ' child(ren)', String(mult)], ['Mandatory add-ons, split equally', money(addonsEach) + ' each']];
        return { monthly: Math.abs(cs) + (payor === 'A' ? 0 : 0) , payor, basis: 'Statewide uniform guideline, § 4055.' + (cs < 0 ? ' The formula is negative: the higher earner has so much of the time that the LOWER earner owes support.' : '') + (TN > 0 && (HN / TN) > 0 && i.lowIncomeThreshold && (payor === 'A' ? nA : nB) < i.lowIncomeThreshold ? ' The obligor\u2019s net disposable income is below the low-income adjustment threshold entered; the court may reduce the amount (§ 4055(b)(7)).' : ''), lines, addonsEach };
      },
    },
    TX: {
      name: 'Texas', cite: 'Tex. Fam. Code §§ 154.061\u2013154.130', dataNote: 'Net-resources cap $11,700 per month, effective September 1, 2025 (Texas Register, Aug. 15, 2025), adjusted every six years; percentages § 154.125; multiple-family table § 154.129.',
      summary: 'Percentage of the OBLIGOR\u2019s net resources only \u2014 the obligee\u2019s income does not enter the guideline. Net resources are all income (wages, self-employment, interest, dividends, rental, retirement, capital gains, severance, trust income, etc.) less federal income tax at the single rate with one personal exemption and the standard deduction, Social Security and Medicare, union dues, and the cost of the child\u2019s health and dental insurance (§ 154.062). Percentages: 20% for one child, 25% two, 30% three, 35% four, 40% five, not less than 40% for six or more, applied to net resources up to the cap; above the cap, additional support only on proof of the child\u2019s needs (§ 154.126). If the obligor has children in other households, § 154.129 reduces the percentages. Below $1,000 of net resources the low-income schedule (15% / 20% / 25% / 30% / 35%) applies. Medical and dental support are ordered in addition (§ 154.181 et seq.). The court may vary from the guideline on the § 154.123 factors with findings.',
      compute(i) {
        const kids = Math.max(1, i.kids); const custodialA = i.overnightsB < 0.5; const obligor = custodialA ? 'B' : 'A';
        const gross = obligor === 'A' ? i.grossA : i.grossB;
        const netMonthly = i.txNetOverride > 0 ? i.txNetOverride : Math.max(0, (gross - fedTax(Math.max(0, gross - DATA.FED_STD_SINGLE)) - fica(gross)) / 12 - i.health);
        const capped = Math.min(netMonthly, DATA.TX_CAP);
        let rate; const other = Math.min(7, Math.max(0, i.txOtherChildren));
        if (netMonthly < 1000) rate = DATA.TX_LOW_PCT[Math.min(4, kids - 1)];
        else if (other > 0) rate = DATA.TX_MULTI[other][Math.min(4, kids - 1)] / 100;
        else rate = kids >= 5 ? 0.40 : DATA.TX_PCT[kids - 1];
        const cs = capped * rate;
        const lines = [['Obligor ' + obligor + '\u2019s monthly net resources' + (i.txNetOverride > 0 ? '' : ' (estimated: gross less federal tax (single, standard deduction), FICA, and the child\u2019s health premium)'), money(netMonthly)], ['Applied to the cap', money(capped) + (netMonthly > DATA.TX_CAP ? ' (' + money(netMonthly - DATA.TX_CAP) + ' above the cap; additional support only on proven needs, § 154.126)' : '')], ['Guideline percentage for ' + kids + (other ? ' with ' + other + ' other child(ren) supported (§ 154.129)' : '') + (netMonthly < 1000 ? ' (low-income schedule)' : ''), pct(rate)], ['Guideline support', money(cs) + '/mo']];
        return { monthly: cs, payor: obligor, basis: 'Percentage of the obligor\u2019s net resources; the obligee\u2019s income is not part of the guideline (it is a § 154.123 factor for deviation). Medical and dental support are ordered separately.', lines };
      },
    },
  };

  /* ══ Tax layer ═════════════════════════════════════════════════════════════ */
  function taxLayer(i) {
    // Who claims the child: default the custodial parent (§ 152(e)); Form 8332 releases to the other.
    const ctc = DATA.CTC * i.kids;
    const hohBenefit = (fedTax(Math.max(0, i.grossA - DATA.FED_STD_SINGLE)) - fedTax(Math.max(0, i.grossA - DATA.FED_STD_HOH)));   // rough: HOH standard deduction on A's income at single rates
    return { ctc, hohBenefit };
  }

  const SAMPLE = { cs_state: 'FL', cs_kids: '2', cs_gross_a: '85,000', cs_gross_b: '160,000', cs_overnights_b: '30', cs_childcare: '1,200', cs_health: '380', cs_paid_by_a: '1,200', cs_state_rate_a: '0', cs_state_rate_b: '0', cs_ny_cap: '193,000', cs_ca_low: '2,900' };

  function inputs() {
    const grossA = numv('cs_gross_a'), grossB = numv('cs_gross_b');
    const stA = pctv('cs_state_rate_a'), stB = pctv('cs_state_rate_b');
    const netAIn = numv('cs_net_a'), netBIn = numv('cs_net_b');
    return {
      state: ($('cs_state') || {}).value || 'FL', kids: Math.max(1, Math.min(10, Math.round(numv('cs_kids') || 1))),
      grossA, grossB, netA: netAIn || estNetMonthly(grossA, stA), netB: netBIn || estNetMonthly(grossB, stB), netAEst: !netAIn, netBEst: !netBIn,
      overnightsB: Math.min(1, Math.max(0, numv('cs_overnights_b') / 100)), shared: !!($('cs_shared') && $('cs_shared').checked),
      childcare: numv('cs_childcare'), health: numv('cs_health'), paidByA: Math.min(numv('cs_paid_by_a'), numv('cs_childcare') + numv('cs_health')),
      healthDeductA: numv('cs_health_deduct_a'), healthDeductB: numv('cs_health_deduct_b'),
      nycTaxA: numv('cs_nyc_a'), nycTaxB: numv('cs_nyc_b'), nyCap: numv('cs_ny_cap'),
      txOtherChildren: numv('cs_tx_other'), txNetOverride: numv('cs_tx_net'), lowIncomeThreshold: numv('cs_ca_low'),
    };
  }

  function compute() {
    const i = inputs(); const jur = J[i.state] || J.FL;
    if (!(i.grossA || i.grossB)) { renderEmpty(jur); return; }
    const g = jur.compute(i);
    const t = taxLayer(i);
    const assumptions = [];
    if ((jur.name === 'Florida' || jur.name === 'California') && (i.netAEst || i.netBEst)) assumptions.push(`Net income for ${i.netAEst && i.netBEst ? 'both parents' : i.netAEst ? 'Parent A' : 'Parent B'} was ESTIMATED from gross (2026 federal single brackets and standard deduction, FICA, and the state rate entered). ${jur.name === 'Florida' ? 'Florida net income under § 61.30(3) is the actual figure after the enumerated deductions, adjusted for filing status and dependents' : 'California net disposable income under § 4059 is the actual after-tax figure the court calculator produces'}; enter the actual numbers for a real result.`);
    if (jur.name === 'Texas' && !i.txNetOverride) assumptions.push('The obligor\u2019s net resources were ESTIMATED from gross using 2026 federal single rates, the standard deduction and FICA, less the child\u2019s health premium entered. Texas uses the Attorney General\u2019s tax charts and deducts union dues and the child\u2019s dental premium as well; enter net resources directly if you have them.');
    if (jur.name === 'New York' && !i.nyCap) assumptions.push('No cap entered; the $193,000 cap effective March 1, 2026 was used. It changes every two years.');
    if (jur.name === 'New York' && !i.nycTaxA && !i.nycTaxB) assumptions.push('No New York City or Yonkers income tax entered; if either parent is a city resident that tax is deducted in reaching CSSA income.');
    if (i.overnightsB === 0) assumptions.push('No overnight percentage entered for Parent B; Parent A is treated as the primary residential parent with Parent B paying. Enter the actual schedule.');
    if (jur.name === 'Florida' && i.overnightsB > 0 && (i.overnightsB < 0.20 || i.overnightsB > 0.80)) assumptions.push('Time-sharing is below the 20% threshold for the § 61.30(11)(b) gross-up; the standard calculation applies, and the court may deviate under (11)(a)10 where time is significant but under 20%.');
    if (jur.name === 'Massachusetts' && !i.shared && i.overnightsB >= 0.4 && i.overnightsB <= 0.6) assumptions.push('Overnights are near equal but the shared box is unchecked; the Massachusetts worksheet has a specific shared-parenting calculation. Check the box if time and financial responsibility are approximately equal.');
    if (jur.name === 'California' && !i.lowIncomeThreshold) assumptions.push('No low-income adjustment threshold entered; the adjustment was not tested. The threshold is indexed annually (§ 4055(b)(7)).');
    if (!i.childcare && !i.health) assumptions.push('No child care or health insurance costs entered; every one of these states adds them to the basic obligation.');
    assumptions.push('The child tax credit and head-of-household figures use 2026 federal parameters (credit $2,200 per qualifying child under 17, phased out above $200,000 for a single filer). Whether a parent can claim a child depends on § 152(e) and any Form 8332 release; the tool does not decide it.');
    render({ i, jur, g, t, assumptions });
  }

  function renderEmpty(jur) {
    const res = $('cs_results'); if (res) res.innerHTML = '<p class="cs-empty">Enter both parents\u2019 incomes and the parenting schedule to see the estimate. Or <button type="button" class="cs-link" data-load-sample>load a sample</button>.</p>';
    const b = res && res.querySelector('[data-load-sample]'); if (b) b.addEventListener('click', loadSample);
    renderJurisdiction(jur);
  }

  function render(m) {
    const { i, jur, g, t, assumptions } = m; const res = $('cs_results'); if (!res) return;
    const who = (p) => p === 'A' ? 'Parent A' : 'Parent B';
    res.innerHTML = `
      ${assumptions.length ? `<div class="cs-assume"><strong>What this run assumed</strong><ul>${assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      <div class="cs-summary">
        <div class="cs-card cs-card-hi"><div class="cs-k">Guideline child support in ${jur.name}</div><div class="cs-v">${money(g.monthly)}<span class="cs-unit">/mo</span></div><div class="cs-s">${g.monthly ? who(g.payor) + ' pays ' + who(g.payor === 'A' ? 'B' : 'A') : 'no transfer on these facts'}${g.weekly != null ? ' \u00b7 ' + money(g.weekly) + '/week as Massachusetts states it' : ''}${g.band ? ' \u00b7 court may vary \u00b15% without findings: ' + money(g.band[0]) + '\u2013' + money(g.band[1]) : ''}</div></div>
        <div class="cs-card"><div class="cs-k">Over a year</div><div class="cs-v">${money(g.monthly * 12)}</div><div class="cs-s">tax-free to the recipient, non-deductible to the payor, in every state</div></div>
        <div class="cs-card"><div class="cs-k">Child tax credit at stake</div><div class="cs-v">${money(t.ctc)}<span class="cs-unit">/yr</span></div><div class="cs-s">$2,200 per qualifying child (2026), to whichever parent claims the child \u2014 the custodial parent by default, or the other by Form 8332 release</div></div>
        <div class="cs-card"><div class="cs-k">Head-of-household filing status</div><div class="cs-v">${money(t.hohBenefit)}<span class="cs-unit">/yr</span></div><div class="cs-s">approximate federal value to Parent A of filing HOH rather than single on the income entered; HOH cannot be released by Form 8332 \u2014 it follows where the child lives</div></div>
      </div>
      <h4>How the figure was built</h4>
      <p>${esc(g.basis)}</p>
      <div class="table-wrap"><table class="cs-table"><tbody>${g.lines.map((l) => `<tr><td>${esc(l[0])}</td><td class="num">${esc(l[1])}</td></tr>`).join('')}</tbody></table></div>
      <h4>The tax questions a guideline calculator leaves on the table</h4>
      <p>Child support itself has no tax consequence. Around it sit decisions worth thousands a year that the guideline does not allocate: <strong>who claims the child</strong> (the credit and, from 2025, $2,200 per child under 17, phasing out above $200,000 of a single filer\u2019s income; alternating years is common and requires a Form 8332 each year); <strong>head-of-household status</strong>, which follows the child\u2019s residence and cannot be traded; the <strong>dependent-care credit</strong> and dependent-care FSA, available only to the parent with custody; the <strong>529 account</strong> and who controls it; and, where a parent is self-employed, the interaction between how income is characterized for support and how it is reported for tax. Florida lists the credit and exemption allocation as a deviation factor (§ 61.30(11)(a)8.); Massachusetts requires the parties to consider the allocation (Section II. B.); New York and California courts routinely allocate the dependency by agreement.</p>
      <p class="cs-meth"><strong>Method.</strong> Each state is computed from its own statute or guidelines with the tables reproduced from the primary source and dated on this page. Estimated net incomes (where the state uses net) apply 2026 federal single-filer brackets, the standard deduction, FICA at 7.65% up to the wage base, and the state rate you enter; they are estimates and are flagged above whenever they are used. Not modeled: imputed income, the New York and California treatment of income above the cap or threshold beyond the note shown, the Massachusetts Table C reduction for children 18 and over, extraordinary medical expenses, private school and extracurriculars, multiple-family adjustments outside Texas, temporary orders, and deviation. Every state\u2019s figure is a presumption the court may depart from on findings; none is an order.</p>`;
    renderJurisdiction(jur);
  }

  function renderJurisdiction(jur) {
    const jn = $('cs_jur_name'); if (jn) jn.textContent = jur.name;
    const jps = $('cs_print_state'); if (jps) jps.textContent = jur.name;
    const jp = $('cs_jur_panel'); if (jp) jp.innerHTML = `<div class="cs-jur-grid"><div><strong>How ${esc(jur.name)} calculates it</strong><p>${esc(jur.summary)}</p></div><div><strong>Authority</strong><p>${esc(jur.cite)}</p><p style="margin-top:.5rem;"><strong>Data in this tool, as of ${esc(DATA.asOf)}:</strong> ${esc(jur.dataNote)}</p></div></div>`;
    document.querySelectorAll('.cs-ny').forEach((el) => { el.style.display = jur.name === 'New York' ? '' : 'none'; });
    document.querySelectorAll('.cs-tx').forEach((el) => { el.style.display = jur.name === 'Texas' ? '' : 'none'; });
    document.querySelectorAll('.cs-ma').forEach((el) => { el.style.display = jur.name === 'Massachusetts' ? '' : 'none'; });
    document.querySelectorAll('.cs-ca').forEach((el) => { el.style.display = jur.name === 'California' ? '' : 'none'; });
    document.querySelectorAll('.cs-net').forEach((el) => { el.style.display = (jur.name === 'Florida' || jur.name === 'California') ? '' : 'none'; });
    document.querySelectorAll('.cs-paid').forEach((el) => { el.style.display = jur.name === 'Florida' ? '' : 'none'; });
  }

  function loadSample() { Object.keys(SAMPLE).forEach((k) => { const el = $(k); if (el) el.value = SAMPLE[k]; }); compute(); const r = $('cs_results'); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function clearAll() { document.querySelectorAll('#cs_form input[type="text"]').forEach((el) => { el.value = ''; }); document.querySelectorAll('#cs_form input[type="checkbox"]').forEach((el) => { el.checked = false; }); const st = $('cs_state'); if (st) st.value = 'FL'; const cap = $('cs_ny_cap'); if (cap) cap.value = '193,000'; compute(); }

  function init() {
    const form = $('cs_form'); if (!form) return;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); else console.warn('[cs] missing #' + id); };
    form.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('input', compute);
      el.addEventListener('change', () => { if (el.dataset.money !== undefined) { const n = Number(String(el.value).replace(/[^0-9.\-]/g, '')); el.value = Number.isFinite(n) && el.value !== '' ? n.toLocaleString('en-US') : ''; } compute(); });
    });
    document.querySelectorAll('[data-cs-sample]').forEach((b) => b.addEventListener('click', loadSample));
    on('cs_reset', 'click', clearAll);
    on('cs_print', 'click', () => window.print());
    compute();
  }
  const safeInit = () => { try { init(); } catch (e) { console.error('[cs] init failed', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit); else safeInit();
  if (typeof module !== 'undefined' && module.exports) module.exports = { J, DATA, flLookup, maLookup, fedTax, fica, estNetMonthly };
})();
