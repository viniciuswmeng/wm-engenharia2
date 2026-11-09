// CUB/m² — base inicial extraída dos relatórios "Tabela do CUB/m² Valores em R$/m²" de www.cub.org.br (CBIC)
// Coletado em 31/10/2026: último mês publicado por cada Sinduscon, sem e com desoneração da mão de obra.
// Novos meses podem ser importados pelo sistema (PDF do mesmo relatório) e ficam guardados no Supabase.

export const FONTE_CUB = "CBIC — www.cub.org.br (CUB/m² Estadual, relatório \"Tabela do CUB/m² Valores em R$/m²\")";
export const COLETADO_EM = "2026-10-31";

// Ordem dos valores nas listas abaixo
export const SIGLAS = ["R1-B", "R1-N", "R1-A", "PP4-B", "PP4-N", "R8-B", "R8-N", "R8-A", "R16-N", "R16-A", "PIS", "RP1Q", "CAL8-N", "CAL8-A", "CSL8-N", "CSL8-A", "CSL16-N", "CSL16-A", "GI"];

// [UF, Sinduscon, id no site da CBIC, ano, mês, valores sem desoneração, valores com desoneração]
const BRUTO = [
  ["AC", "Sinduscon-AC", 4, 2026, 3, [3256.64, 3708.21, 4888.03, 3306.51, 3674.41, 3149.13, 3250.36, 4058.25, 3181.41, 4409.98, 2318.18, 3112.89, 3887.97, 4308.55, 3228.85, 3714.18, 4328.78, 4942.01, 1731.8], [3169.07, 3586.36, 4755.81, 3232.86, 3566.66, 3079.9, 3153.48, 3955.94, 3088.22, 4295.03, 2258.53, 2996.13, 3779.84, 4199.38, 3131.41, 3614.07, 4199.06, 4808.68, 1677.6]],
  ["AM", "Sinduscon-AM", 5, 2026, 9, [3123.54, 3748, 5102.16, 2948.85, 3406.38, 2750.07, 3144.13, 4026.33, 2984.78, 4039.29, 1994.04, 3008.48, 3416.97, 3627.76, 3125.34, 3448.76, 4196.05, 4601.76, 1743.69], [3010.73, 3591, 4931.81, 2853.97, 3267.55, 2660.88, 3019.33, 3894.52, 2864.71, 3891.19, 1917.2, 2858.03, 3277.65, 3487.11, 2999.8, 3319.78, 4028.92, 4429.98, 1673.86]],
  ["BA", "Sinduscon-BA", 6, 2026, 9, [2338.12, 2734.31, 3352.72, 2115.75, 2585.68, 1994.99, 2243.22, 2658.52, 2170.69, 2810.96, 1550.37, 2330.98, 2599.63, 2743.19, 2235.59, 2420.28, 2979.77, 3219.74, 1219.47], [2221.92, 2574.91, 3179.77, 2018.23, 2444.68, 1903.29, 2116.59, 2524.56, 2048.95, 2660.48, 1471.19, 2179.09, 2458.48, 2600.68, 2108.16, 2289.28, 2810.08, 3045.2, 1148.58]],
  ["CE", "Sinduscon-CE", 7, 2026, 9, [2425.2, 2971.06, 3546.1, 2401.58, 2848.09, 2229.04, 2510.74, 2969.94, 2437.51, 3100.62, 1878.21, 2644.73, 2831.86, 2996.96, 2402.96, 2592.28, 3302.25, 3559.87, 1314.64], [2287.82, 2781.86, 3340.8, 2286.22, 2680.74, 2120.57, 2360.41, 2810.97, 2292.95, 2922.04, 1784.61, 2464.15, 2664.21, 2827.71, 2251.69, 2436.8, 3100.82, 3352.73, 1230.49]],
  ["DF", "Sinduscon-DF", 8, 2026, 9, [2488.34, 2932.8, 3589.05, 2302.76, 2748.68, 2183.64, 2416.71, 2907.24, 2343.02, 3008.58, 1709.49, 2540.47, 2782.62, 3015.11, 2363.49, 2625.26, 3164.62, 3497.31, 1328.63], [2361.12, 2757.23, 3398.54, 2195.89, 2593.4, 2083.16, 2277.2, 2759.75, 2208.85, 2842.89, 1622.81, 2372.78, 2627.01, 2858.01, 2223.12, 2481, 2977.72, 3305.12, 1250.55]],
  ["ES", "Sinduscon-ES", 9, 2026, 9, [2891.16, 3479.99, 4261.81, 2678.61, 3245.69, 2530.39, 2829.12, 3416.3, 2744.53, 3592.07, 1991.59, 3012.98, 3184.55, 3441.95, 2738.62, 3023.31, 3658.96, 4029.99, 1506.3], [2762.9, 3304.26, 4071.15, 2570.99, 3090.25, 2429.18, 2689.55, 3268.61, 2610.34, 3426.17, 1904.18, 2845.62, 3028.97, 3284.88, 2598.15, 2878.89, 3471.89, 3837.56, 1428.16]],
  ["GO", "Sinduscon-GO", 10, 2026, 9, [2302.55, 2795.37, 3430.67, 2050.62, 2567.02, 1936.93, 2243.09, 2707.18, 2174.94, 2858.23, 1513.5, 2352.27, 2552.59, 2729.22, 2219.73, 2427.41, 2954.06, 3227.83, 1259.12], [2158.66, 2597.64, 3216.13, 1929.83, 2392.12, 1823.35, 2086.01, 2541.02, 2023.9, 2671.58, 1415.46, 2163.73, 2377.45, 2552.41, 2061.66, 2264.92, 2743.56, 3011.34, 1171.19]],
  ["MA", "Sinduscon-MA", 11, 2026, 9, [1998.66, 2289.83, 2838.57, 1797.93, 2147.25, 1716.33, 1909.37, 2317.68, 1846.57, 2417.69, 1318.7, 1975.43, 2216.78, 2357.83, 1891.58, 2044.41, 2534.07, 2727.46, 1101.87], [1919.56, 2180.05, 2719.46, 1731.43, 2050.17, 1653.82, 1822.12, 2225.49, 1762.64, 2314.12, 1264.81, 1870.35, 2119.4, 2259.52, 1803.8, 1954.22, 2417.21, 2607.33, 1053.04]],
  ["MT", "Sinduscon-MT", 13, 2026, 9, [3337.14, 4009, 4899.76, 3066.34, 3793.69, 2922.4, 3314.8, 4003.82, 3206.08, 4112.94, 2239.89, 3310.35, 3814.36, 4128.29, 3240.12, 3561.3, 4345.95, 4760.1, 1732.57], [3145.73, 3746.82, 4615.3, 2905.74, 3561.77, 2771.37, 3106.55, 3783.45, 3005.87, 3865.42, 2109.45, 3060.68, 3582.26, 3893.96, 3030.54, 3345.83, 4066.84, 4473, 1615.98]],
  ["MG", "Sinduscon-Juiz de Fora", 32, 2026, 9, [2146.06, 2620.36, 3187.86, 2008.22, 2454.89, 1896.18, 2161.75, 2565.45, 2104.91, 2747.25, 1493.26, 2315.04, 2471.81, 2620.29, 2137.95, 2316.25, 2865.85, 3101.05, 1193.66], [2013.63, 2437.67, 2989.63, 1896.99, 2293.31, 1791.59, 2016.59, 2411.98, 1965.31, 2574.84, 1403.03, 2140.59, 2309.91, 2456.84, 1991.89, 2166.13, 2671.37, 2901.07, 1112.42]],
  ["MG", "Sinduscon-GV", 39, 2026, 9, [2076.84, 2451.75, 3170.36, 2010.13, 2298.94, 1915.86, 2048.29, 2556.99, 1995.02, 2589.87, 1411.28, 2106.83, 2325.54, 2489.77, 1986.74, 2195.09, 2682.63, 2959.66, 1191.36], [1990.75, 2333.13, 3041.65, 1937.83, 2194.02, 1847.88, 1954.04, 2457.33, 1904.38, 2477.91, 1352.63, 1993.6, 2220.43, 2383.65, 1891.9, 2097.61, 2556.35, 2829.8, 1138.61]],
  ["MG", "Sinduscon-MG", 1, 2026, 7, [2554.54, 3082.77, 3824.03, 2422.37, 2928.24, 2286.98, 2548.75, 3107.73, 2474.8, 3223.56, 1767.9, 2642.55, 2953.03, 3205.91, 2493.5, 2749.68, 3339.33, 3680.49, 1336.91], [2494.73, 3000.43, 3734.68, 2372.15, 2855.41, 2239.75, 2483.32, 3038.54, 2411.88, 3145.83, 1727.15, 2563.97, 2880.07, 3132.25, 2427.66, 2682.01, 3251.67, 3590.34, 1300.29]],
  ["PR", "Sinduscon-PR", 18, 2026, 9, [2681.59, 3365.21, 4109.51, 2459.78, 3144.71, 2327.91, 2738.93, 3328.1, 2657.44, 3388.41, 1869.1, 2903.54, 3101.53, 3333.78, 2674.19, 2969.34, 3577.05, 3968.94, 1475.96], [2594.85, 3245.11, 3979.19, 2386.89, 3038.5, 2259.38, 2643.48, 3227.23, 2565.63, 3275.09, 1810.01, 2788.68, 2995.03, 3226.26, 2578.16, 2870.66, 3449.2, 3837.49, 1422.55]],
  ["PR", "Sinduscon-Noroeste-PR", 19, 2026, 9, [2818.41, 3262.76, 4087.19, 2692.97, 3104.31, 2562.02, 2741.62, 3302.53, 2675.94, 3428.07, 2037.68, 2917.25, 3168.92, 3427.45, 2688.45, 3017.27, 3599.74, 4009.54, 1489.74], [2661.44, 3040.69, 3846.18, 2560.62, 2908.01, 2437.67, 2564.92, 3116.29, 2505.84, 3218.74, 1930.8, 2703.1, 2971.35, 3228.02, 2510.8, 2834.9, 3363.33, 3766.74, 1390.95]],
  ["PB", "Sinduscon-João Pessoa", 15, 2026, 9, [1649.58, 2047.06, 2520.36, 1571.85, 1938.71, 1503.42, 1716.69, 2105.2, 1671.1, 2269, 1108.64, 1770.77, 1957.46, 2084.33, 1713.94, 1850.9, 2305.71, 2492.43, 967.16], [1565.79, 1930.5, 2393.87, 1501.39, 1835.63, 1437.18, 1624.03, 2007.33, 1581.95, 2159.04, 1051.57, 1659.08, 1854.02, 1979.9, 1620.73, 1755.14, 2181.62, 2364.88, 915.32]],
  ["PA", "Sinduscon-PA", 14, 2026, 9, [2459.47, 2855.61, 3577, 2315.58, 2699.06, 2201.52, 2374.18, 2878.49, 2317.19, 3118.24, 1708.74, 2477.65, 2724.25, 2904.35, 2350.98, 2582.87, 3149.7, 3445.47, 1337.34], [2365.65, 2725.08, 3435.36, 2236.68, 2583.64, 2127.35, 2270.41, 2768.9, 2217.37, 2995.1, 1644.84, 2352.58, 2608.41, 2787.41, 2246.6, 2475.64, 3010.74, 3302.64, 1279.29]],
  ["PE", "Sinduscon-PE", 16, 2026, 9, [2361.01, 2795.91, 3422.72, 2109.61, 2661.27, 1979.73, 2240.23, 2749.32, 2179.27, 2819.78, 1593.69, 2291.17, 2610.12, 2807.29, 2204.29, 2425.62, 2943.98, 3233.87, 1240.79], [2249.23, 2640.05, 3253.59, 2015.58, 2523.45, 1891.34, 2116.31, 2618.48, 2060.05, 2672.76, 1517.56, 2141.7, 2471.75, 2667.61, 2079.65, 2297.58, 2778.06, 3063.34, 1171.46]],
  ["PI", "Sinduscon-Teresina", 17, 2026, 8, [2873.09, 3644.79, 4879.17, 2627.77, 3285.89, 2465.85, 2949.64, 3752.8, 2863.28, 3674.82, 1743.83, 2909.88, 3312.66, 3584.05, 2827.54, 3081.18, 3776.38, 4117.55, 1568.22], [2791.22, 3530.35, 4754.97, 2558.86, 3184.7, 2401.09, 2858.63, 3656.74, 2775.71, 3566.88, 1688.07, 2800.02, 3211.02, 3481.45, 2736.01, 2987.17, 3654.54, 3992.35, 1517.32]],
  ["RN", "Sinduscon-RN", 21, 2026, 8, [2296.38, 2583.52, 3201.37, 2131.66, 2493.2, 2023.24, 2150.02, 2649.47, 2065.19, 2727.22, 1570.23, 2212.8, 2470.38, 2607.06, 2129.17, 2291.73, 2839.76, 3056.35, 1249.99], [2234.79, 2496.32, 3106.73, 2079.72, 2416.12, 1974.44, 2080.63, 2576.35, 1998.39, 2645.02, 1528.29, 2128.69, 2392.79, 2528.74, 2059.41, 2220.12, 2746.93, 2961.02, 1211.2]],
  ["RJ", "Sinduscon-Rio", 20, 2026, 10, [2482.17, 2996.91, 3698.47, 2324.25, 2830.81, 2196.79, 2483.57, 2964.53, 2407.16, 3153.36, 1727.05, 2621.28, 2868.37, 3062.2, 2459.93, 2688.52, 3291.01, 3590.88, 1365.91], [2411.64, 2899.02, 3592.24, 2264.96, 2744.24, 2141.05, 2405.75, 2882.33, 2332.31, 3061, 1679.01, 2527.57, 2781.53, 2974.53, 2381.66, 2608.1, 3186.8, 3483.76, 1322.37]],
  ["RR", "Sinduscon-RR", 30, 2026, 9, [2935.31, 3289.5, 4636.79, 2716.63, 3080.63, 2598.95, 2845.87, 3718.09, 2738.91, 3738.3, 1929.72, 2620.89, 3372.66, 3597.21, 2908.86, 3191.73, 3881.84, 4239.52, 1692.89], [2870.71, 3200.99, 4540.75, 2662.43, 3002.33, 2547.98, 2775.56, 3643.7, 2671.31, 3654.74, 1885.7, 2536.59, 3294.29, 3518.09, 2838.11, 3118.99, 3787.61, 4142.6, 1653.53]],
  ["SC", "Sinduscon Grande Florianópolis-SC", 26, 2026, 10, [2884.39, 3447.11, 4208.63, 2624.93, 3181.59, 2482.89, 2811.78, 3344.13, 2715.47, 3481.27, 1996.86, 3078.45, 3207.62, 3406.18, 2793.82, 3052.6, 3728.33, 4056.56, 1572.33], [2700.22, 3195.66, 3935.81, 2470.48, 2959.14, 2337.63, 2612.1, 3132.74, 2523.51, 3243.84, 1871.36, 2839.3, 2985.13, 3181.55, 2592.83, 2845.94, 3460.65, 3781.17, 1460.52]],
  ["MG", "Sinduscon-Vale do Piranga", 33, 2021, 1, [1479.05, 1783.09, 2100.55, 1418.69, 1679.99, 1347.11, 1474.98, 1716.85, 1423.95, 1862.4, 985.62, 1521.37, 1614.81, 1711.64, 1432.84, 1552.98, 1939.54, 2097.58, 768.48], [1426.71, 1711.14, 2022.49, 1374.75, 1616.35, 1305.79, 1417.82, 1656.4, 1368.99, 1794.49, 949.95, 1452.77, 1551.09, 1647.3, 1375.33, 1493.86, 1862.95, 2018.82, 736.49]],
  ["MG", "Sinduscon-Lagos", 34, 2021, 11, [1583.15, 1886.42, 2330.16, 1516.24, 1815.63, 1454.85, 1609.91, 1922.52, 1559.28, 2028.15, 1093.08, 1606.64, 1832.42, 1921.07, 1613.47, 1724.4, 2163.23, 2306.42, 892.8], [1492.75, 1765.04, 2198.49, 1440.61, 1708.22, 1383.69, 1513.61, 1820.36, 1466.78, 1913.45, 1031.44, 1491.98, 1725.3, 1812.92, 1516.49, 1624.6, 2034.01, 2173.37, 838.83]],
  ["MG", "Sinduscon Norte", 36, 2022, 12, [2119.96, 2331.02, 3005.84, 2035.51, 2211.48, 1946.3, 2099.72, 2553.51, 2033.82, 2697.2, 1421.44, 2143.22, 2518.89, 2695.64, 2097.22, 2284.79, 2834.91, 3079.58, 1150.68], [2022.7, 2197.71, 2861.2, 1953.9, 2093.56, 1869.55, 1993.83, 2441.47, 1932.01, 2571.35, 1355.17, 2016.24, 2400.85, 2576.48, 1990.65, 2175.23, 2692.99, 2933.6, 1091.4]],
];

const paraObjeto = lista => Object.fromEntries(SIGLAS.map((s, i) => [s, lista[i]]));
export const REGISTROS_BASE = BRUTO.map(([uf, sinduscon, idCbic, ano, mes, sem, com]) => ({
  id: `${uf}|${sinduscon}`, uf, sinduscon, idCbic, ano, mes, origem: "CBIC",
  sem: paraObjeto(sem), com: paraObjeto(com),
}));

export const UFS = {
  AC: ["Acre", "Norte"], AM: ["Amazonas", "Norte"], PA: ["Pará", "Norte"], RR: ["Roraima", "Norte"], RO: ["Rondônia", "Norte"], AP: ["Amapá", "Norte"], TO: ["Tocantins", "Norte"],
  BA: ["Bahia", "Nordeste"], CE: ["Ceará", "Nordeste"], MA: ["Maranhão", "Nordeste"], PB: ["Paraíba", "Nordeste"], PE: ["Pernambuco", "Nordeste"], PI: ["Piauí", "Nordeste"], RN: ["Rio Grande do Norte", "Nordeste"], SE: ["Sergipe", "Nordeste"], AL: ["Alagoas", "Nordeste"],
  DF: ["Distrito Federal", "Centro-Oeste"], GO: ["Goiás", "Centro-Oeste"], MT: ["Mato Grosso", "Centro-Oeste"], MS: ["Mato Grosso do Sul", "Centro-Oeste"],
  ES: ["Espírito Santo", "Sudeste"], MG: ["Minas Gerais", "Sudeste"], RJ: ["Rio de Janeiro", "Sudeste"], SP: ["São Paulo", "Sudeste"],
  PR: ["Paraná", "Sul"], SC: ["Santa Catarina", "Sul"], RS: ["Rio Grande do Sul", "Sul"],
};
export const REGIOES = ["Sudeste", "Sul", "Centro-Oeste", "Nordeste", "Norte"];

// Projetos-padrão da ABNT NBR 12721:2006 (descrição, área real e área equivalente do projeto-padrão — cub.org.br/projetos-padrao)
export const PROJETOS_PADRAO = {
  "R1-B": { nome: "Residência unifamiliar — padrão baixo", grupo: "Residencial", desc: "1 pavimento, 2 dormitórios, sala, banheiro, cozinha e área para tanque.", areaReal: 58.64, areaEq: 51.94 },
  "R1-N": { nome: "Residência unifamiliar — padrão normal", grupo: "Residencial", desc: "1 pavimento, 3 dormitórios (1 suíte), banheiro social, sala, circulação, cozinha, área de serviço com banheiro e varanda (abrigo para automóvel).", areaReal: 106.44, areaEq: 99.47 },
  "R1-A": { nome: "Residência unifamiliar — padrão alto", grupo: "Residencial", desc: "1 pavimento, 4 dormitórios (1 suíte com closet, outro com banheiro), banheiro social, salas de estar, jantar e íntima, circulação, cozinha, área de serviço completa e varanda (abrigo para automóvel).", areaReal: 224.82, areaEq: 210.44 },
  "RP1Q": { nome: "Residência unifamiliar popular", grupo: "Residencial", desc: "1 pavimento, 1 dormitório, sala, banheiro e cozinha.", areaReal: 39.56, areaEq: 39.56 },
  "PIS": { nome: "Residência multifamiliar — projeto de interesse social", grupo: "Residencial", desc: "Térreo e 4 pavimentos-tipo, 4 apartamentos por andar com 2 dormitórios, sala, banheiro, cozinha e área de serviço; guarita e central de medição.", areaReal: 991.45, areaEq: 978.09 },
  "PP4-B": { nome: "Prédio popular — padrão baixo", grupo: "Residencial", desc: "Térreo e 3 pavimentos-tipo, 4 apartamentos por andar com 2 dormitórios; lixo, guarita, central de gás, depósito e 16 vagas descobertas.", areaReal: 1415.07, areaEq: 927.08 },
  "PP4-N": { nome: "Prédio popular — padrão normal", grupo: "Residencial", desc: "Pilotis e 4 pavimentos-tipo com elevador, 32 vagas cobertas, salão de festas; 4 apartamentos por andar com 3 dormitórios (1 suíte) e varanda.", areaReal: 2590.35, areaEq: 1840.45 },
  "R8-B": { nome: "Residência multifamiliar — padrão baixo", grupo: "Residencial", desc: "Térreo e 7 pavimentos-tipo com elevador, 4 apartamentos por andar com 2 dormitórios; 32 vagas descobertas.", areaReal: 2801.64, areaEq: 1885.51 },
  "R8-N": { nome: "Residência multifamiliar — padrão normal", grupo: "Residencial", desc: "Garagem, pilotis e 8 pavimentos-tipo; 64 vagas cobertas, salão de festas; 4 apartamentos por andar com 3 dormitórios (1 suíte) e varanda.", areaReal: 5998.73, areaEq: 4135.22 },
  "R8-A": { nome: "Residência multifamiliar — padrão alto", grupo: "Residencial", desc: "Garagem, pilotis e 8 pavimentos-tipo; 48 vagas cobertas, salões de festas e jogos; 2 apartamentos por andar com 4 dormitórios (1 suíte com closet) e varanda.", areaReal: 5917.79, areaEq: 4644.79 },
  "R16-N": { nome: "Residência multifamiliar — padrão normal (16 pav.)", grupo: "Residencial", desc: "Garagem, pilotis e 16 pavimentos-tipo; 128 vagas cobertas, salão de festas; 4 apartamentos por andar com 3 dormitórios (1 suíte) e varanda.", areaReal: 10562.07, areaEq: 8224.5 },
  "R16-A": { nome: "Residência multifamiliar — padrão alto (16 pav.)", grupo: "Residencial", desc: "Garagem, pilotis e 16 pavimentos-tipo; 96 vagas cobertas, salões de festas e jogos; 2 apartamentos por andar com 4 dormitórios (1 suíte com closet) e varanda.", areaReal: 10461.85, areaEq: 8371.4 },
  "CAL8-N": { nome: "Comercial andares livres — padrão normal", grupo: "Comercial", desc: "Garagem, térreo com lojas e 8 pavimentos-tipo em andares corridos com sanitário privativo; 64 vagas cobertas.", areaReal: 5290.62, areaEq: 3096.09 },
  "CAL8-A": { nome: "Comercial andares livres — padrão alto", grupo: "Comercial", desc: "Garagem, térreo com lojas e 8 pavimentos-tipo em andares corridos com sanitário privativo; 64 vagas cobertas.", areaReal: 5290.62, areaEq: 3096.09 },
  "CSL8-N": { nome: "Comercial salas e lojas — padrão normal", grupo: "Comercial", desc: "Garagem, térreo com lojas e 8 pavimentos-tipo com 8 salas por andar (sanitário privativo); 64 vagas cobertas.", areaReal: 5942.94, areaEq: 3921.55 },
  "CSL8-A": { nome: "Comercial salas e lojas — padrão alto", grupo: "Comercial", desc: "Garagem, térreo com lojas e 8 pavimentos-tipo com 8 salas por andar (sanitário privativo); 64 vagas cobertas.", areaReal: 5942.94, areaEq: 3921.55 },
  "CSL16-N": { nome: "Comercial salas e lojas — padrão normal (16 pav.)", grupo: "Comercial", desc: "Garagem, térreo com lojas e 16 pavimentos-tipo com 8 salas por andar; 128 vagas cobertas.", areaReal: 9140.57, areaEq: 5734.46 },
  "CSL16-A": { nome: "Comercial salas e lojas — padrão alto (16 pav.)", grupo: "Comercial", desc: "Garagem, térreo com lojas e 16 pavimentos-tipo com 8 salas por andar; 128 vagas cobertas.", areaReal: 9140.57, areaEq: 5734.46 },
  "GI": { nome: "Galpão industrial", grupo: "Industrial", desc: "Galpão com área administrativa, 2 banheiros, vestiário e depósito.", areaReal: 1000, areaEq: null },
};

// Observações oficiais que acompanham a tabela do CUB/m² (texto dos relatórios da CBIC)
export const OBS_CUB = [
  "Os valores referem-se aos Custos Unitários Básicos de Construção (CUB/m²), calculados de acordo com a Lei Federal nº 4.591, de 16/12/1964, e com a ABNT NBR 12721:2006.",
  "Estes custos unitários foram calculados conforme disposto na ABNT NBR 12721:2006, com base em novos projetos, novos memoriais descritivos e novos critérios de orçamentação e, portanto, constituem nova série histórica de custos unitários, não comparáveis com a anterior, com a designação de CUB/2006.",
  "Na formação destes custos unitários básicos não foram considerados os seguintes itens, que devem ser levados em conta na determinação dos preços por metro quadrado de construção, de acordo com o estabelecido no projeto e especificações correspondentes a cada caso particular: fundações, submuramentos, paredes-diafragma, tirantes, rebaixamento de lençol freático; elevador(es); equipamentos e instalações, tais como fogões, aquecedores, bombas de recalque, incineração, ar-condicionado, calefação, ventilação e exaustão, outros; playground (quando não classificado como área construída); obras e serviços complementares; urbanização, recreação (piscinas, campos de esporte), ajardinamento, instalação e regulamentação do condomínio; e outros serviços (que devem ser discriminados no Anexo A — quadro III); impostos, taxas e emolumentos cartoriais; projetos: projetos arquitetônicos, projeto estrutural, projeto de instalação, projetos especiais; remuneração do construtor; remuneração do incorporador.",
];
export const OBS_DESONERADO = "Nota técnica — CUB/m² desonerado: calculado para atender ao art. 7º da Lei 12.546/11 (alterada pelas Leis 12.844/13 e 13.161/15), que trata da desoneração da folha de pagamentos na construção civil. Só pode ser usado por empresas cuja atividade principal esteja nos grupos 412, 432, 433 e 439 da CNAE 2.0; não se aplica ao grupo 411 (incorporação de empreendimentos imobiliários). A metodologia é a mesma do CUB/m²; a diferença está apenas nos encargos sociais sobre a mão de obra, sem os 20% da previdência social e suas reincidências. Dúvidas sobre o cálculo devem ser consultadas junto ao Sinduscon responsável pela divulgação.";

// Itens que NÃO estão no CUB (NBR 12721) — entram como parcelas adicionais no estudo
export const ITENS_FORA_CUB = [
  { id: "fundacoes", nome: "Fundações, submuramentos, paredes-diafragma, tirantes e rebaixamento de lençol freático", modo: "pct", valor: 5 },
  { id: "elevadores", nome: "Elevador(es)", modo: "valor", valor: 0 },
  { id: "equipamentos", nome: "Equipamentos e instalações especiais (aquecedores, bombas de recalque, ar-condicionado, ventilação e exaustão…)", modo: "pct", valor: 0 },
  { id: "playground", nome: "Playground (quando não classificado como área construída)", modo: "valor", valor: 0 },
  { id: "complementares", nome: "Obras e serviços complementares", modo: "pct", valor: 0 },
  { id: "urbanizacao", nome: "Urbanização, recreação (piscinas, campos de esporte), ajardinamento", modo: "valor", valor: 0 },
  { id: "condominio", nome: "Instalação e regulamentação do condomínio", modo: "valor", valor: 0 },
  { id: "impostos", nome: "Impostos, taxas e emolumentos cartoriais", modo: "pct", valor: 0 },
  { id: "projetos", nome: "Projetos (arquitetônico, estrutural, instalações e especiais)", modo: "pct", valor: 0 },
  { id: "construtor", nome: "Remuneração do construtor", modo: "pct", valor: 0 },
  { id: "incorporador", nome: "Remuneração do incorporador", modo: "pct", valor: 0 },
];

// Coeficientes de equivalência de área (ABNT NBR 12721:2006, item 5.7.3 — faixas de referência; sugere-se o valor médio)
export const COEFICIENTES_AREA = [
  { id: "principal", nome: "Área privativa / coberta padrão", coef: 1.0, faixa: "1,00" },
  { id: "garagem", nome: "Garagem (subsolo)", coef: 0.6, faixa: "0,50 – 0,75" },
  { id: "salas-sem-acab", nome: "Área privativa (salas com acabamento simples)", coef: 0.85, faixa: "0,75 – 0,90" },
  { id: "varanda", nome: "Varandas", coef: 0.85, faixa: "0,75 – 1,00" },
  { id: "terraco", nome: "Terraços ou áreas descobertas sobre lajes", coef: 0.45, faixa: "0,30 – 0,60" },
  { id: "estac-descoberto", nome: "Estacionamento sobre terreno", coef: 0.08, faixa: "0,05 – 0,10" },
  { id: "caixa-agua", nome: "Área de projeção do reservatório de água", coef: 0.6, faixa: "0,50 – 0,75" },
  { id: "piscina", nome: "Piscinas", coef: 0.6, faixa: "0,50 – 0,75" },
  { id: "quintal", nome: "Quintais, calçadas, jardins etc.", coef: 0.2, faixa: "0,10 – 0,30" },
  { id: "barrilete", nome: "Barrilete", coef: 0.6, faixa: "0,50 – 0,75" },
  { id: "maquinas", nome: "Casa de máquinas", coef: 1.0, faixa: "1,00" },
];

export const MESES_ABR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const rotMes = (ano, mes) => `${MESES_ABR[(mes || 1) - 1]}/${ano}`;
