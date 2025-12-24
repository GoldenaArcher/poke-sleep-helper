import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams
} from "react-router-dom";
import { FiBriefcase } from "react-icons/fi";
import { IoCloseOutline } from "react-icons/io5";

const dishLevelConfig = {
  "Fancy Apple Salad": [
    { level: 1, experience: 0, value: 855 },
    { level: 2, experience: 1080, value: 872 },
    { level: 3, experience: 2324, value: 889 },
    { level: 4, experience: 3936, value: 906 },
    { level: 5, experience: 5545, value: 923 },
    { level: 6, experience: 7341, value: 932 },
    { level: 7, experience: 9712, value: 949 },
    { level: 8, experience: 12760, value: 966 },
    { level: 9, experience: 16426, value: 992 },
    { level: 10, experience: 20791, value: 1009 },
    { level: 11, experience: 25639, value: 1017 },
    { level: 12, experience: 30911, value: 1035 },
    { level: 13, experience: 36621, value: 1052 },
    { level: 14, experience: 42922, value: 1060 },
    { level: 15, experience: 49882, value: 1077 },
    { level: 16, experience: 57551, value: 1094 },
    { level: 17, experience: 66001, value: 1112 },
    { level: 18, experience: 75131, value: 1120 },
    { level: 19, experience: 84981, value: 1137 },
    { level: 20, experience: 95642, value: 1154 },
    { level: 21, experience: 107159, value: 1171 },
    { level: 22, experience: 119576, value: 1197 },
    { level: 23, experience: 132938, value: 1214 },
    { level: 24, experience: 147309, value: 1240 },
    { level: 25, experience: 162621, value: 1257 },
    { level: 26, experience: 178929, value: 1283 },
    { level: 27, experience: 196563, value: 1300 },
    { level: 28, experience: 215605, value: 1325 },
    { level: 29, experience: 236149, value: 1351 },
    { level: 30, experience: 258299, value: 1377 },
    { level: 31, experience: 281955, value: 1402 },
    { level: 32, experience: 306759, value: 1428 },
    { level: 33, experience: 332769, value: 1454 },
    { level: 34, experience: 360469, value: 1488 },
    { level: 35, experience: 389943, value: 1513 },
    { level: 36, experience: 421521, value: 1548 },
    { level: 37, experience: 455380, value: 1573 },
    { level: 38, experience: 491055, value: 1607 },
    { level: 39, experience: 528663, value: 1642 },
    { level: 40, experience: 568918, value: 1676 },
    { level: 41, experience: 611541, value: 1710 },
    { level: 42, experience: 656646, value: 1744 },
    { level: 43, experience: 704344, value: 1778 },
    { level: 44, experience: 754748, value: 1821 },
    { level: 45, experience: 807184, value: 1855 },
    { level: 46, experience: 862205, value: 1898 },
    { level: 47, experience: 920936, value: 1941 },
    { level: 48, experience: 983590, value: 1984 },
    { level: 49, experience: 1050391, value: 2026 },
    { level: 50, experience: 1121582, value: 2069 },
    { level: 51, experience: 1196687, value: 2120 },
    { level: 52, experience: 1319485, value: 2163 },
    { level: 53, experience: 1471363, value: 2214 },
    { level: 54, experience: 1672589, value: 2266 },
    { level: 55, experience: 1930878, value: 2317 },
    { level: 56, experience: 2231322, value: 2368 },
    { level: 57, experience: 2579312, value: 2420 },
    { level: 58, experience: 2977994, value: 2480 },
    { level: 59, experience: 3413120, value: 2539 },
    { level: 60, experience: 3891145, value: 2591 },
    { level: 61, experience: 4433557, value: 2642 },
    { level: 62, experience: 5054788, value: 2693 },
    { level: 63, experience: 5773019, value: 2745 },
    { level: 64, experience: 6606405, value: 2796 },
    { level: 65, experience: 7599103, value: 2856 }
  ],
  "Dazzling Apple Cheese Salad": [
    { level: 1, experience: 0, value: 2655 },
    { level: 2, experience: 1080, value: 2708 },
    { level: 3, experience: 2324, value: 2761 },
    { level: 4, experience: 3936, value: 2814 },
    { level: 5, experience: 5545, value: 2867 },
    { level: 6, experience: 7341, value: 2894 },
    { level: 7, experience: 9712, value: 2947 },
    { level: 8, experience: 12760, value: 3000 },
    { level: 9, experience: 16426, value: 3080 },
    { level: 10, experience: 20791, value: 3133 },
    { level: 11, experience: 25639, value: 3159 },
    { level: 12, experience: 30911, value: 3213 },
    { level: 13, experience: 36621, value: 3266 },
    { level: 14, experience: 42922, value: 3292 },
    { level: 15, experience: 49882, value: 3345 },
    { level: 16, experience: 57551, value: 3398 },
    { level: 17, experience: 66001, value: 3452 },
    { level: 18, experience: 75131, value: 3478 },
    { level: 19, experience: 84981, value: 3531 },
    { level: 20, experience: 95642, value: 3584 },
    { level: 21, experience: 107159, value: 3637 },
    { level: 22, experience: 119576, value: 3717 },
    { level: 23, experience: 132938, value: 3770 },
    { level: 24, experience: 147309, value: 3850 },
    { level: 25, experience: 162621, value: 3903 },
    { level: 26, experience: 178929, value: 3983 },
    { level: 27, experience: 196563, value: 4036 },
    { level: 28, experience: 215605, value: 4115 },
    { level: 29, experience: 236149, value: 4195 },
    { level: 30, experience: 258299, value: 4275 },
    { level: 31, experience: 281955, value: 4354 },
    { level: 32, experience: 306759, value: 4434 },
    { level: 33, experience: 332769, value: 4514 },
    { level: 34, experience: 360469, value: 4620 },
    { level: 35, experience: 389943, value: 4699 },
    { level: 36, experience: 421521, value: 4806 },
    { level: 37, experience: 455380, value: 4885 },
    { level: 38, experience: 491055, value: 4991 },
    { level: 39, experience: 528663, value: 5098 },
    { level: 40, experience: 568918, value: 5204 },
    { level: 41, experience: 611541, value: 5310 },
    { level: 42, experience: 656646, value: 5416 },
    { level: 43, experience: 704344, value: 5522 },
    { level: 44, experience: 754748, value: 5655 },
    { level: 45, experience: 807184, value: 5761 },
    { level: 46, experience: 862205, value: 5894 },
    { level: 47, experience: 920936, value: 6027 },
    { level: 48, experience: 983590, value: 6160 },
    { level: 49, experience: 1050391, value: 6292 },
    { level: 50, experience: 1121582, value: 6425 },
    { level: 51, experience: 1196687, value: 6584 },
    { level: 52, experience: 1319485, value: 6717 },
    { level: 53, experience: 1471363, value: 6876 },
    { level: 54, experience: 1672589, value: 7036 },
    { level: 55, experience: 1930878, value: 7195 },
    { level: 56, experience: 2231322, value: 7354 },
    { level: 57, experience: 2579312, value: 7514 },
    { level: 58, experience: 2977994, value: 7700 },
    { level: 59, experience: 3413120, value: 7885 },
    { level: 60, experience: 3891145, value: 8045 },
    { level: 61, experience: 4433557, value: 8204 },
    { level: 62, experience: 5054788, value: 8363 },
    { level: 63, experience: 5773019, value: 8523 },
    { level: 64, experience: 6606405, value: 8682 },
    { level: 65, experience: 7599103, value: 8868 }
  ],
  "Fancy Apple Curry": [
    { level: 1, experience: 0, value: 748 },
    { level: 2, experience: 1080, value: 763 },
    { level: 3, experience: 2324, value: 778 },
    { level: 4, experience: 3936, value: 793 },
    { level: 5, experience: 5545, value: 808 },
    { level: 6, experience: 7341, value: 815 },
    { level: 7, experience: 9712, value: 830 },
    { level: 8, experience: 12760, value: 845 },
    { level: 9, experience: 16426, value: 868 },
    { level: 10, experience: 20791, value: 883 },
    { level: 11, experience: 25639, value: 890 },
    { level: 12, experience: 30911, value: 905 },
    { level: 13, experience: 36621, value: 920 },
    { level: 14, experience: 42922, value: 928 },
    { level: 15, experience: 49882, value: 942 },
    { level: 16, experience: 57551, value: 957 },
    { level: 17, experience: 66001, value: 972 },
    { level: 18, experience: 75131, value: 980 },
    { level: 19, experience: 84981, value: 995 },
    { level: 20, experience: 95642, value: 1010 },
    { level: 21, experience: 107159, value: 1025 },
    { level: 22, experience: 119576, value: 1047 },
    { level: 23, experience: 132938, value: 1062 },
    { level: 24, experience: 147309, value: 1085 },
    { level: 25, experience: 162621, value: 1100 },
    { level: 26, experience: 178929, value: 1122 },
    { level: 27, experience: 196563, value: 1137 },
    { level: 28, experience: 215605, value: 1159 },
    { level: 29, experience: 236149, value: 1182 },
    { level: 30, experience: 258299, value: 1204 },
    { level: 31, experience: 281955, value: 1227 },
    { level: 32, experience: 306759, value: 1249 },
    { level: 33, experience: 332769, value: 1272 },
    { level: 34, experience: 360469, value: 1302 },
    { level: 35, experience: 389943, value: 1324 },
    { level: 36, experience: 421521, value: 1354 },
    { level: 37, experience: 455380, value: 1376 },
    { level: 38, experience: 491055, value: 1406 },
    { level: 39, experience: 528663, value: 1436 },
    { level: 40, experience: 568918, value: 1466 },
    { level: 41, experience: 611541, value: 1496 },
    { level: 42, experience: 656646, value: 1526 },
    { level: 43, experience: 704344, value: 1556 },
    { level: 44, experience: 754748, value: 1593 },
    { level: 45, experience: 807184, value: 1623 },
    { level: 46, experience: 862205, value: 1661 },
    { level: 47, experience: 920936, value: 1698 },
    { level: 48, experience: 983590, value: 1735 },
    { level: 49, experience: 1050391, value: 1773 },
    { level: 50, experience: 1121582, value: 1810 },
    { level: 51, experience: 1196687, value: 1855 },
    { level: 52, experience: 1319485, value: 1892 },
    { level: 53, experience: 1471363, value: 1937 },
    { level: 54, experience: 1672589, value: 1982 },
    { level: 55, experience: 1930878, value: 2027 },
    { level: 56, experience: 2231322, value: 2072 },
    { level: 57, experience: 2579312, value: 2117 },
    { level: 58, experience: 2977994, value: 2169 },
    { level: 59, experience: 3413120, value: 2222 },
    { level: 60, experience: 3891145, value: 2266 },
    { level: 61, experience: 4433557, value: 2311 },
    { level: 62, experience: 5054788, value: 2356 },
    { level: 63, experience: 5773019, value: 2401 },
    { level: 64, experience: 6606405, value: 2446 },
    { level: 65, experience: 7599103, value: 2498 }
  ],
  "Simple Chowder": [
    { level: 1, experience: 0, value: 814 },
    { level: 2, experience: 1080, value: 830 },
    { level: 3, experience: 2324, value: 847 },
    { level: 4, experience: 3936, value: 863 },
    { level: 5, experience: 5545, value: 879 },
    { level: 6, experience: 7341, value: 887 },
    { level: 7, experience: 9712, value: 904 },
    { level: 8, experience: 12760, value: 920 },
    { level: 9, experience: 16426, value: 944 },
    { level: 10, experience: 20791, value: 961 },
    { level: 11, experience: 25639, value: 969 },
    { level: 12, experience: 30911, value: 985 },
    { level: 13, experience: 36621, value: 1001 },
    { level: 14, experience: 42922, value: 1009 },
    { level: 15, experience: 49882, value: 1026 },
    { level: 16, experience: 57551, value: 1042 },
    { level: 17, experience: 66001, value: 1058 },
    { level: 18, experience: 75131, value: 1066 },
    { level: 19, experience: 84981, value: 1083 },
    { level: 20, experience: 95642, value: 1099 },
    { level: 21, experience: 107159, value: 1115 },
    { level: 22, experience: 119576, value: 1140 },
    { level: 23, experience: 132938, value: 1156 },
    { level: 24, experience: 147309, value: 1180 },
    { level: 25, experience: 162621, value: 1197 },
    { level: 26, experience: 178929, value: 1221 },
    { level: 27, experience: 196563, value: 1237 },
    { level: 28, experience: 215605, value: 1262 },
    { level: 29, experience: 236149, value: 1286 },
    { level: 30, experience: 258299, value: 1311 },
    { level: 31, experience: 281955, value: 1335 },
    { level: 32, experience: 306759, value: 1359 },
    { level: 33, experience: 332769, value: 1384 },
    { level: 34, experience: 360469, value: 1416 },
    { level: 35, experience: 389943, value: 1441 },
    { level: 36, experience: 421521, value: 1473 },
    { level: 37, experience: 455380, value: 1498 },
    { level: 38, experience: 491055, value: 1530 },
    { level: 39, experience: 528663, value: 1563 },
    { level: 40, experience: 568918, value: 1595 },
    { level: 41, experience: 611541, value: 1628 },
    { level: 42, experience: 656646, value: 1661 },
    { level: 43, experience: 704344, value: 1693 },
    { level: 44, experience: 754748, value: 1734 },
    { level: 45, experience: 807184, value: 1766 },
    { level: 46, experience: 862205, value: 1807 },
    { level: 47, experience: 920936, value: 1848 },
    { level: 48, experience: 983590, value: 1888 },
    { level: 49, experience: 1050391, value: 1929 },
    { level: 50, experience: 1121582, value: 1970 },
    { level: 51, experience: 1196687, value: 2019 },
    { level: 52, experience: 1319485, value: 2059 },
    { level: 53, experience: 1471363, value: 2108 },
    { level: 54, experience: 1672589, value: 2157 },
    { level: 55, experience: 1930878, value: 2206 },
    { level: 56, experience: 2231322, value: 2255 },
    { level: 57, experience: 2579312, value: 2304 },
    { level: 58, experience: 2977994, value: 2361 },
    { level: 59, experience: 3413120, value: 2418 },
    { level: 60, experience: 3891145, value: 2466 },
    { level: 61, experience: 4433557, value: 2515 },
    { level: 62, experience: 5054788, value: 2564 },
    { level: 63, experience: 5773019, value: 2613 },
    { level: 64, experience: 6606405, value: 2662 },
    { level: 65, experience: 7599103, value: 2719 }
  ],
  "Beanburger Curry": [
    { level: 1, experience: 0, value: 856 },
    { level: 2, experience: 1080, value: 873 },
    { level: 3, experience: 2324, value: 890 },
    { level: 4, experience: 3936, value: 907 },
    { level: 5, experience: 5545, value: 924 },
    { level: 6, experience: 7341, value: 933 },
    { level: 7, experience: 9712, value: 950 },
    { level: 8, experience: 12760, value: 967 },
    { level: 9, experience: 16426, value: 993 },
    { level: 10, experience: 20791, value: 1010 },
    { level: 11, experience: 25639, value: 1019 },
    { level: 12, experience: 30911, value: 1036 },
    { level: 13, experience: 36621, value: 1053 },
    { level: 14, experience: 42922, value: 1061 },
    { level: 15, experience: 49882, value: 1079 },
    { level: 16, experience: 57551, value: 1096 },
    { level: 17, experience: 66001, value: 1113 },
    { level: 18, experience: 75131, value: 1121 },
    { level: 19, experience: 84981, value: 1138 },
    { level: 20, experience: 95642, value: 1156 },
    { level: 21, experience: 107159, value: 1173 },
    { level: 22, experience: 119576, value: 1198 },
    { level: 23, experience: 132938, value: 1216 },
    { level: 24, experience: 147309, value: 1241 },
    { level: 25, experience: 162621, value: 1258 },
    { level: 26, experience: 178929, value: 1284 },
    { level: 27, experience: 196563, value: 1301 },
    { level: 28, experience: 215605, value: 1327 },
    { level: 29, experience: 236149, value: 1352 },
    { level: 30, experience: 258299, value: 1378 },
    { level: 31, experience: 281955, value: 1404 },
    { level: 32, experience: 306759, value: 1430 },
    { level: 33, experience: 332769, value: 1455 },
    { level: 34, experience: 360469, value: 1489 },
    { level: 35, experience: 389943, value: 1515 },
    { level: 36, experience: 421521, value: 1549 },
    { level: 37, experience: 455380, value: 1575 },
    { level: 38, experience: 491055, value: 1609 },
    { level: 39, experience: 528663, value: 1644 },
    { level: 40, experience: 568918, value: 1678 },
    { level: 41, experience: 611541, value: 1712 },
    { level: 42, experience: 656646, value: 1746 },
    { level: 43, experience: 704344, value: 1780 },
    { level: 44, experience: 754748, value: 1823 },
    { level: 45, experience: 807184, value: 1858 },
    { level: 46, experience: 862205, value: 1900 },
    { level: 47, experience: 920936, value: 1943 },
    { level: 48, experience: 983590, value: 1986 },
    { level: 49, experience: 1050391, value: 2029 },
    { level: 50, experience: 1121582, value: 2072 },
    { level: 51, experience: 1196687, value: 2123 },
    { level: 52, experience: 1319485, value: 2166 },
    { level: 53, experience: 1471363, value: 2217 },
    { level: 54, experience: 1672589, value: 2268 },
    { level: 55, experience: 1930878, value: 2320 },
    { level: 56, experience: 2231322, value: 2371 },
    { level: 57, experience: 2579312, value: 2422 },
    { level: 58, experience: 2977994, value: 2482 },
    { level: 59, experience: 3413120, value: 2542 },
    { level: 60, experience: 3891145, value: 2594 },
    { level: 61, experience: 4433557, value: 2645 },
    { level: 62, experience: 5054788, value: 2696 },
    { level: 63, experience: 5773019, value: 2748 },
    { level: 64, experience: 6606405, value: 2799 },
    { level: 65, experience: 7599103, value: 2859 }
  ],
  "Mild Honey Curry": [
    { level: 1, experience: 0, value: 839 },
    { level: 2, experience: 1080, value: 856 },
    { level: 3, experience: 2324, value: 873 },
    { level: 4, experience: 3936, value: 889 },
    { level: 5, experience: 5545, value: 906 },
    { level: 6, experience: 7341, value: 915 },
    { level: 7, experience: 9712, value: 931 },
    { level: 8, experience: 12760, value: 948 },
    { level: 9, experience: 16426, value: 973 },
    { level: 10, experience: 20791, value: 990 },
    { level: 11, experience: 25639, value: 998 },
    { level: 12, experience: 30911, value: 1015 },
    { level: 13, experience: 36621, value: 1032 },
    { level: 14, experience: 42922, value: 1040 },
    { level: 15, experience: 49882, value: 1057 },
    { level: 16, experience: 57551, value: 1074 },
    { level: 17, experience: 66001, value: 1091 },
    { level: 18, experience: 75131, value: 1099 },
    { level: 19, experience: 84981, value: 1116 },
    { level: 20, experience: 95642, value: 1133 },
    { level: 21, experience: 107159, value: 1149 },
    { level: 22, experience: 119576, value: 1175 },
    { level: 23, experience: 132938, value: 1191 },
    { level: 24, experience: 147309, value: 1217 },
    { level: 25, experience: 162621, value: 1233 },
    { level: 26, experience: 178929, value: 1259 },
    { level: 27, experience: 196563, value: 1275 },
    { level: 28, experience: 215605, value: 1300 },
    { level: 29, experience: 236149, value: 1326 },
    { level: 30, experience: 258299, value: 1351 },
    { level: 31, experience: 281955, value: 1376 },
    { level: 32, experience: 306759, value: 1401 },
    { level: 33, experience: 332769, value: 1426 },
    { level: 34, experience: 360469, value: 1460 },
    { level: 35, experience: 389943, value: 1485 },
    { level: 36, experience: 421521, value: 1519 },
    { level: 37, experience: 455380, value: 1544 },
    { level: 38, experience: 491055, value: 1577 },
    { level: 39, experience: 528663, value: 1611 },
    { level: 40, experience: 568918, value: 1644 },
    { level: 41, experience: 611541, value: 1678 },
    { level: 42, experience: 656646, value: 1712 },
    { level: 43, experience: 704344, value: 1745 },
    { level: 44, experience: 754748, value: 1787 },
    { level: 45, experience: 807184, value: 1821 },
    { level: 46, experience: 862205, value: 1863 },
    { level: 47, experience: 920936, value: 1905 },
    { level: 48, experience: 983590, value: 1946 },
    { level: 49, experience: 1050391, value: 1988 },
    { level: 50, experience: 1121582, value: 2030 },
    { level: 51, experience: 1196687, value: 2081 },
    { level: 52, experience: 1319485, value: 2123 },
    { level: 53, experience: 1471363, value: 2173 },
    { level: 54, experience: 1672589, value: 2223 },
    { level: 55, experience: 1930878, value: 2274 },
    { level: 56, experience: 2231322, value: 2324 },
    { level: 57, experience: 2579312, value: 2374 },
    { level: 58, experience: 2977994, value: 2433 },
    { level: 59, experience: 3413120, value: 2492 },
    { level: 60, experience: 3891145, value: 2542 },
    { level: 61, experience: 4433557, value: 2593 },
    { level: 62, experience: 5054788, value: 2643 },
    { level: 63, experience: 5773019, value: 2693 },
    { level: 64, experience: 6606405, value: 2744 },
    { level: 65, experience: 7599103, value: 2802 }
  ]
};

const getDishLevelData = (dishName, level) => {
  const table = dishLevelConfig[dishName];
  if (!table) {
    return null;
  }
  return table.find((entry) => entry.level === level) || table[0];
};

const apiFetch = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return response.json();
};

export default function App() {
  const [settings, setSettings] = useState({
    ingredientLimit: 100,
    itemLimit: 100
  });
  const [ingredients, setIngredients] = useState([]);
  const [items, setItems] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [filterCookable, setFilterCookable] = useState(false);
  const [dishType, setDishType] = useState("all");
  const [newItem, setNewItem] = useState({ name: "", quantity: "" });
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: ""
  });
  const [status, setStatus] = useState("");
  const [bagOpen, setBagOpen] = useState(false);
  const [ingredientCatalog, setIngredientCatalog] = useState([]);

  const loadData = async () => {
    try {
      const [settingsData, ingredientData, itemData, dishData, catalog] =
        await Promise.all([
          apiFetch("/api/settings"),
          apiFetch("/api/bag/ingredients"),
          apiFetch("/api/bag/items"),
          apiFetch("/api/dishes"),
          apiFetch("/api/ingredients/catalog")
        ]);
      setSettings(settingsData);
      setIngredients(ingredientData);
      setItems(itemData);
      setDishes(dishData);
      setIngredientCatalog(catalog);
    } catch (error) {
      setStatus("Failed to load data.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshDishes = async () => {
    const dishData = await apiFetch("/api/dishes");
    setDishes(dishData);
  };

  const ingredientTotal = useMemo(
    () =>
      ingredients.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      ),
    [ingredients]
  );

  const itemTotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [items]
  );

  const visibleDishes = useMemo(() => {
    if (!filterCookable) {
      return dishes;
    }
    return dishes.filter((dish) => dish.canCook);
  }, [dishes, filterCookable]);

  const filteredDishes = useMemo(() => {
    if (dishType === "all") {
      return visibleDishes;
    }
    return visibleDishes.filter((dish) => dish.type === dishType);
  }, [visibleDishes, dishType]);

  const ingredientNames = useMemo(() => {
    const merged = new Set();
    ingredientCatalog.forEach((name) => merged.add(name));
    ingredients.forEach((item) => merged.add(item.name));
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [ingredientCatalog, ingredients]);

  const ingredientUsage = useMemo(() => {
    const map = new Map();
    dishes.forEach((dish) => {
      dish.ingredients.forEach((ingredient) => {
        const key = ingredient.name.toLowerCase();
        const entry = map.get(key) || {
          name: ingredient.name,
          dishes: []
        };
        entry.dishes.push(dish);
        map.set(key, entry);
      });
    });
    return map;
  }, [dishes]);

  const bagIngredientMap = useMemo(
    () =>
      new Map(ingredients.map((item) => [item.name.toLowerCase(), item])),
    [ingredients]
  );

  const addIngredient = async () => {
    const trimmedName = newIngredient.name.trim();
    if (!trimmedName) {
      return;
    }
    const existing = ingredients.find(
      (item) => item.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      await updateIngredient(existing.id, {
        name: existing.name,
        quantity: Number(newIngredient.quantity) || 0
      });
      setNewIngredient({ name: "", quantity: "" });
      return;
    }
    setStatus("");
    try {
      const created = await apiFetch("/api/bag/ingredients", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          quantity: Number(newIngredient.quantity) || 0
        })
      });
      setIngredients((prev) => [...prev, created]);
      setNewIngredient({ name: "", quantity: "" });
      await refreshDishes();
      setStatus("Ingredient added.");
    } catch (error) {
      setStatus("Failed to add ingredient.");
    }
  };

  const updateIngredient = async (ingredientId, payload) => {
    try {
      const updated = await apiFetch(`/api/bag/ingredients/${ingredientId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setIngredients((prev) =>
        prev.map((item) => (item.id === ingredientId ? updated : item))
      );
      await refreshDishes();
    } catch (error) {
      setStatus("Failed to update ingredient.");
    }
  };

  const deleteIngredient = async (ingredientId) => {
    try {
      await apiFetch(`/api/bag/ingredients/${ingredientId}`, {
        method: "DELETE"
      });
      setIngredients((prev) => prev.filter((item) => item.id !== ingredientId));
      await refreshDishes();
    } catch (error) {
      setStatus("Failed to remove ingredient.");
    }
  };

  const saveSettings = async () => {
    setStatus("");
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          ingredientLimit: Number(settings.ingredientLimit) || 0,
          itemLimit: Number(settings.itemLimit) || 0
        })
      });
      setStatus("Bag limits updated.");
    } catch (error) {
      setStatus("Failed to update settings.");
    }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) {
      return;
    }
    setStatus("");
    try {
      const created = await apiFetch("/api/bag/items", {
        method: "POST",
        body: JSON.stringify({
          name: newItem.name.trim(),
          quantity: Number(newItem.quantity) || 0
        })
      });
      setItems((prev) => [...prev, created]);
      setNewItem({ name: "", quantity: "" });
      setStatus("Item added.");
    } catch (error) {
      setStatus("Failed to add item.");
    }
  };

  const updateItem = async (itemId, payload) => {
    try {
      const updated = await apiFetch(`/api/bag/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? updated : item))
      );
    } catch (error) {
      setStatus("Failed to update item.");
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await apiFetch(`/api/bag/items/${itemId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (error) {
      setStatus("Failed to remove item.");
    }
  };

  const updateDishLevel = async (dishId, level) => {
    try {
      const updated = await apiFetch(`/api/dishes/${dishId}`, {
        method: "PUT",
        body: JSON.stringify({ dishLevel: Number(level) || 1 })
      });
      setDishes((prev) =>
        prev.map((dish) => (dish.id === dishId ? { ...dish, ...updated } : dish))
      );
      setStatus("");
    } catch (error) {
      setStatus("Failed to update dish level.");
    }
  };

  const DishesView = () => (
    <>
      <header className="hero">
        <p className="eyebrow">Dishes</p>
        <h2>Menu</h2>
        <p className="subhead">
          {filteredDishes.length} dishes
          {filterCookable ? " (cookable only)" : ""}
        </p>
      </header>

      <section className="card">
        <div className="section-header">
          <div className="chip-group">
            {[
              { label: "All", value: "all" },
              { label: "Curry", value: "curry" },
              { label: "Salad", value: "salad" },
              { label: "Dessert", value: "dessert" }
            ].map((type) => (
              <button
                key={type.value}
                className={`chip ${dishType === type.value ? "active" : ""}`}
                onClick={() => setDishType(type.value)}
              >
                {type.label}
              </button>
            ))}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={filterCookable}
              onChange={(event) => setFilterCookable(event.target.checked)}
            />
            Show cookable only
          </label>
        </div>
        <div className="dish-table">
          <div className="dish-row header">
            <div>Name</div>
            <div>Description</div>
            <div>Ingredients</div>
          </div>
          {filteredDishes.map((dish) => (
            <div
              key={dish.id}
              className={`dish-row ${dish.canCook ? "ready" : ""}`}
            >
              <div className="dish-name">
                <div className="name-line">
                  <Link className="dish-link" to={`/dishes/${dish.id}`}>
                    {dish.name}
                  </Link>
                  <span className="pill">
                    {dish.canCook ? "Cookable" : "Missing"}
                  </span>
                </div>
                <div className="inline-fields compact">
                  <span className="meta">
                    Strength:{" "}
                    {getDishLevelData(dish.name, dish.dish_level || 1)?.value ??
                      dish.base_strength}
                  </span>
                  <span className="meta">Type: {dish.type}</span>
                </div>
              </div>
              <div className="dish-desc">{dish.description || "—"}</div>
              <div className="dish-ingredients">
                {dish.ingredients.length === 0 && (
                  <span className="empty">Any combo works.</span>
                )}
                <div className="ingredient-list">
                  {dish.ingredients.map((ingredient) => (
                    <div key={ingredient.id}>
                      <Link
                        className="ingredient-link"
                        to={`/ingredients/${encodeURIComponent(
                          ingredient.name
                        )}`}
                      >
                        {ingredient.name}
                      </Link>{" "}
                      × {ingredient.quantity}
                    </div>
                  ))}
                  {dish.ingredients.length > 0 && (
                    <div className="ingredient-total">
                      Total:{" "}
                      {dish.ingredients.reduce(
                        (sum, ingredient) => sum + ingredient.quantity,
                        0
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  const IngredientsListView = () => (
    <>
      <header className="hero">
        <p className="eyebrow">Ingredients</p>
        <h2>Catalog</h2>
        <p className="subhead">{ingredientNames.length} ingredients</p>
      </header>
      <section className="card">
        <div className="ingredient-table">
          <div className="ingredient-row header">
            <div>Name</div>
            <div>In bag</div>
            <div>Used in dishes</div>
          </div>
          {ingredientNames.map((name) => {
            const key = name.toLowerCase();
            const bagItem = bagIngredientMap.get(key);
            const usage = ingredientUsage.get(key);
            const usageCount = usage ? usage.dishes.length : 0;
            return (
              <div key={name} className="ingredient-row">
                <div>
                  <Link
                    className="ingredient-link"
                    to={`/ingredients/${encodeURIComponent(name)}`}
                  >
                    {name}
                  </Link>
                </div>
                <div>{bagItem ? Number(bagItem.quantity) || 0 : 0}</div>
                <div>{usageCount}</div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );

  const IngredientDetailView = () => {
    const { ingredientName } = useParams();
    const navigate = useNavigate();
    const decodedName = decodeURIComponent(ingredientName || "");
    const key = decodedName.toLowerCase();
    const bagItem = bagIngredientMap.get(key);
    const usage = ingredientUsage.get(key);
    const relatedDishes = usage ? usage.dishes : [];

    return (
      <>
        <header className="hero">
          <p className="eyebrow">Ingredient</p>
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h2>{decodedName || "Unknown"}</h2>
          <p className="subhead">
            In bag: {bagItem ? Number(bagItem.quantity) || 0 : 0} • Used in{" "}
            {relatedDishes.length} dishes
          </p>
        </header>

        <section className="card">
          <h3>List of all Dishes Made with {decodedName}</h3>
          <div className="ingredient-dishes grid-cards">
            {relatedDishes.length === 0 && (
              <p className="empty">No dishes found.</p>
            )}
            {relatedDishes.map((dish) => (
              <div key={dish.id} className="dish-mini">
                <Link className="dish-link" to={`/dishes/${dish.id}`}>
                  {dish.name}
                </Link>
                <span className="meta">Type: {dish.type}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card placeholder">
          <h3>List of all Pokémon that may gather {decodedName}</h3>
          <p className="meta">Add Pokemon data to list sources here.</p>
        </section>
      </>
    );
  };

  const PlaceholderView = ({ title, description }) => (
    <section className="card placeholder">
      <h2>{title}</h2>
      <p className="meta">{description}</p>
    </section>
  );

  const DishDetailView = () => {
    const { dishId } = useParams();
    const navigate = useNavigate();
    const dish = dishes.find((item) => String(item.id) === dishId);

    if (!dish) {
      return (
        <section className="card placeholder">
          <p className="meta">Dish not found.</p>
        </section>
      );
    }

    const level = dish.dish_level || 1;
    const levelData = getDishLevelData(dish.name, level);

    return (
      <>
        <header className="hero">
          <p className="eyebrow">Dish</p>
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h2>{dish.name}</h2>
          <p className="subhead">Type: {dish.type}</p>
        </header>

        <section className="card">
          <h3>Level settings</h3>
          {levelData ? (
            <div className="level-grid">
              <label>
                Level
                <select
                  value={level}
                  onChange={(event) =>
                    updateDishLevel(dish.id, event.target.value)
                  }
                >
                  {dishLevelConfig[dish.name].map((entry) => (
                    <option key={entry.level} value={entry.level}>
                      Level {entry.level}
                    </option>
                  ))}
                </select>
              </label>
              <div className="stat">
                <span className="meta">Experience required</span>
                <strong>{levelData.experience.toLocaleString()}</strong>
              </div>
              <div className="stat">
                <span className="meta">Strength</span>
                <strong>{levelData.value}</strong>
              </div>
            </div>
          ) : (
            <p className="meta">No level data available for this dish yet.</p>
          )}
        </section>
      </>
    );
  };

  return (
    <BrowserRouter>
      <div className="layout">
        <aside className="rail">
          <div className="brand">
            <p className="eyebrow">Poke Sleep</p>
            <h1>Helper</h1>
          </div>
          <nav className="nav">
            <NavLink to="/" end>
              Dishes
            </NavLink>
            <NavLink to="/ingredients">Ingredients</NavLink>
            <NavLink to="/pokedex">Pokedex</NavLink>
            <NavLink to="/teams">Teams</NavLink>
          </nav>
          <button
            className={`bag-button ${bagOpen ? "active" : ""}`}
            onClick={() => setBagOpen((open) => !open)}
            aria-label="Toggle bag"
          >
            <FiBriefcase />
            Bag
          </button>
        </aside>

        <main className="page">
          <Routes>
            <Route path="/" element={<DishesView />} />
            <Route path="/dishes/:dishId" element={<DishDetailView />} />
            <Route path="/ingredients" element={<IngredientsListView />} />
            <Route
              path="/ingredients/:ingredientName"
              element={<IngredientDetailView />}
            />
            <Route
              path="/pokedex"
              element={
                <PlaceholderView
                  title="Pokedex"
                  description="Placeholder for future Pokemon tracking and notes."
                />
              }
            />
            <Route
              path="/teams"
              element={
                <PlaceholderView
                  title="Teams"
                  description="Placeholder for party setup and role planning."
                />
              }
            />
          </Routes>
          {status && <p className="status">{status}</p>}
        </main>

        {bagOpen && (
          <div className="bag-modal">
            <section className="card grid">
              <header className="section-header bag-header">
                <div>
                  <h2>Bag</h2>
                  <p className="meta">
                    Ingredients: {ingredientTotal} / {settings.ingredientLimit}{" "}
                    <span>•</span> Items: {itemTotal} / {settings.itemLimit}
                  </p>
                </div>
                <div className="inline-fields">
                  <button className="button ghost" onClick={saveSettings}>
                    Save limits
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => setBagOpen(false)}
                    aria-label="Close bag"
                  >
                    <IoCloseOutline size={20} />
                  </button>
                </div>
              </header>

            <div>
              <h3>Bag limits</h3>
              <div className="inline-fields">
                <label>
                  Ingredients cap
                  <input
                    type="number"
                    min="0"
                    value={settings.ingredientLimit}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        ingredientLimit: Number(event.target.value)
                      }))
                    }
                  />
                </label>
                <label>
                  Items cap
                  <input
                    type="number"
                    min="0"
                    value={settings.itemLimit}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        itemLimit: Number(event.target.value)
                      }))
                    }
                  />
                </label>
              </div>
            </div>

            <div>
              <h3>Bag items</h3>
              <div className="inline-fields">
                <input
                  type="text"
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(event) =>
                    setNewItem((prev) => ({
                      ...prev,
                      name: event.target.value
                    }))
                  }
                />
                <input
                  type="number"
                  min="0"
                  value={newItem.quantity}
                  onChange={(event) =>
                    setNewItem((prev) => ({
                      ...prev,
                      quantity: event.target.value
                    }))
                  }
                />
                <button className="button ghost" onClick={addItem}>
                  Add
                </button>
              </div>
              <ul className="list">
                {items.length === 0 && (
                  <li className="empty">No items yet.</li>
                )}
                {items.map((item) => (
                  <li key={item.id} className="row">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) =>
                        setItems((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, name: event.target.value }
                              : entry
                          )
                        )
                      }
                      onBlur={(event) =>
                        updateItem(item.id, { name: event.target.value })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(event) =>
                        setItems((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? {
                                  ...entry,
                                  quantity: event.target.value
                                }
                              : entry
                          )
                        )
                      }
                      onBlur={(event) =>
                        updateItem(item.id, {
                          quantity: Number(event.target.value) || 0
                        })
                      }
                    />
                    <button
                      className="button ghost"
                      onClick={() => deleteItem(item.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="section-header">
                <div>
                  <h3>Ingredients</h3>
                  <p className="meta">
                    Update your bag so dish availability stays accurate.
                  </p>
                </div>
              </div>
              <div className="inline-fields">
                <input
                  type="search"
                  placeholder="Ingredient name"
                  value={newIngredient.name}
                  list="ingredient-suggestions"
                  onChange={(event) =>
                    setNewIngredient((prev) => ({
                      ...prev,
                      name: event.target.value
                    }))
                  }
                />
                <datalist id="ingredient-suggestions">
                  {ingredientCatalog.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <input
                  type="number"
                  min="0"
                  value={newIngredient.quantity}
                  onChange={(event) =>
                    setNewIngredient((prev) => ({
                      ...prev,
                      quantity: event.target.value
                    }))
                  }
                />
                <button className="button ghost" onClick={addIngredient}>
                  Add
                </button>
              </div>
              <ul className="list">
                {ingredients.length === 0 && (
                  <li className="empty">No ingredients yet.</li>
                )}
                {ingredients.map((item) => (
                  <li key={item.id} className="row">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) =>
                        setIngredients((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, name: event.target.value }
                              : entry
                          )
                        )
                      }
                      onBlur={(event) =>
                        updateIngredient(item.id, { name: event.target.value })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(event) =>
                        setIngredients((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? {
                                  ...entry,
                                  quantity: event.target.value
                                }
                              : entry
                          )
                        )
                      }
                      onBlur={(event) =>
                        updateIngredient(item.id, {
                          quantity: Number(event.target.value) || 0
                        })
                      }
                    />
                    <button
                      className="button ghost"
                      onClick={() => deleteIngredient(item.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="divider" />
              <p className="meta total-line">
                Total ingredients: {ingredientTotal} /{" "}
                {settings.ingredientLimit}
              </p>
            </div>
            </section>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}
