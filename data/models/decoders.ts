/*
  Engine ID Info: https://www.minimania.com/Engine___Identification_Data_UPDATED
  Metro Engine ID Info: https://www.minimania.com/Engine___Metro_engine_identification_data
  Chassis Info: https://www.minimania.com/Mini_Chassis_VIN_and_Commission_Numbers__Part_I__Revised_
  Chassis Info 2: https://www.minimania.com/Mini_Chassis_VIN_and_Commission_Numbers__Part_II
  Production History: https://www.somerfordmini.co.uk/mini-production-history
  JoltFreak VIN Guide: https://joltfreak.tripod.com/id13.html
  Australian Minis: https://eight-fifty.com/identification/australian-minis/
  Australian ID Plate: https://eight-fifty.com/identification/identification-plate/
  Victorian Mini Club ID Guide: https://www.mini.org.au/identify-a-classic-mini
*/
export interface ChassisRange {
  title: string;
  value: {
    PrimaryExample: {
      '1': string;
      '2': string;
      '3': string;
      '4': string;
      '5': string;
      '6': string;
      '7': string;
      '8': string;
      '9': string;
      '10': string;
      '11': string;
      numbers: string;
      last: string;
    };
    options: {
      '1': { value: string; name: string }[];
      '2': { value: string; name: string }[];
      '3': { value: string; name: string }[];
      '4': { value: string; name: string }[];
      '5': { value: string; name: string }[];
      '6': { value: string; name: string }[];
      '7': { value: string; name: string }[];
      '8': { value: string; name: string }[];
      '9': { value: string; name: string }[];
      '10': { value: string; name: string }[];
      '11': { value: string; name: string }[];
    };
    number: string;
    last: { value: string; name: string }[];
  };
}

export const chassisRanges: ChassisRange[] = [
  {
    title: '1959-1969',
    value: {
      // A-A2S7L-###A
      PrimaryExample: {
        1: 'A-',
        2: 'A',
        3: '2S',
        4: '7',
        5: 'L-',
        6: '',
        7: '',
        8: '',
        9: '',
        10: '',
        11: '',
        numbers: '###',
        last: 'A',
      },
      options: {
        1: [
          { value: 'A', name: ' Austin (other than Cooper and S)' },
          { value: 'C', name: ' Austin Cooper or Austin Cooper S' },
          { value: 'K', name: ' Morris Cooper or Cooper S' },
          { value: 'M', name: 'Morris' },
          { value: 'R', name: ' Riley' },
          { value: 'W', name: ' Wolseley' },
        ],
        2: [
          {
            value: 'A',
            name: 'A-series engine (848cc, 970cc Cooper S, 997cc Cooper, 998cc Cooper and non-Cooper, 1071cc Cooper S, 1275cc Cooper S)',
          },
        ],
        // Body Type
        3: [
          {
            value: '2S',
            name: '2-door Saloon. Bureaucratic bungles often interpret this as 25',
          },
          { value: 'B', name: 'Moke (“Buckboard”)' },
          { value: 'U', name: 'Pick-up. "U" and "V" can be mistaken one for the other' },
          { value: 'V', name: 'Panel van. "U" and "V" can be mistaken one for the other' },
          { value: 'W', name: 'Estate (with or without wood). Officially, “Dual-purpose”' },
        ],
        // Series of Austin, or Morris
        4: [
          { value: '1', name: 'Mk1 Riley Elf, Wolseley Hornet, and Austin/Morris Moke' },
          { value: '2', name: 'Mk2 Riley Elf or Wolseley Hornet' },
          { value: '3', name: 'Mk3 Riley Elf or Wolseley Hornet' },
          { value: '4', name: 'Mk1 Morris' },
          { value: '6', name: 'Mk2 Morris' },
          { value: '7', name: 'Mk1 Austin' },
          { value: 'B', name: 'Mk2 Austin' },
        ],
        // Trim
        5: [
          { value: 'D', name: 'De-Luxe' },
          { value: 'L', name: 'Left-hand drive. Right-hand drive was not designated' },
          { value: 'S', name: 'Super De-Luxe' },
        ],
        6: [],
        7: [],
        8: [],
        9: [],
        10: [],
        11: [],
      },
      number: '###',
      // Assembly Plant
      last: [
        { value: 'A', name: 'Longbridge' },
        { value: 'M', name: 'Cowley' },
      ],
    },
    // Manufacturer
  },
  {
    title: '1969-1974',
    value: {
      // 'X-A2S1N-###-A'
      PrimaryExample: {
        1: 'X-',
        2: 'A',
        3: '2S',
        4: '1',
        5: 'N-',
        6: '',
        7: '',
        8: '',
        9: '',
        10: '',
        11: '',
        numbers: '###-',
        last: 'A',
      },
      options: {
        1: [{ value: 'X', name: 'This is simply dismissed by the factory as "non-significant"!' }],
        2: [
          {
            value: 'A',
            name: 'A-series engine (848cc Mini 850, 998cc Mini 1000, or 1275cc Cooper S Mk3 / 1275GT)',
          },
        ],
        3: [
          {
            value: '2S',
            name: '2-door Saloon (except Mk3 Cooper S and 1275GT). Caution: bureaucratic bungles often misinterpret this as 25',
          },
          { value: '2W', name: 'Estate (“2-door Dual Purpose”). Used on X-A2W2 / X-L2W2 Clubman Estate prefixes' },
          { value: 'D', name: '2-door saloon (Mk3 Cooper S X-AD1 and 1275GT X-AD2 only)' },
          { value: 'U', name: 'Pick-up (e.g. X-AU1). Caution: "U" and "V" can be mistaken one for the other' },
          { value: 'V', name: 'Panel van (e.g. X-AV1). Caution: "U" and "V" can be mistaken one for the other' },
        ],
        4: [
          { value: '', name: 'Mini 850. Produced only in the "round nose" style' },
          {
            value: '1',
            name: 'Round nose, traditional Mini body style. Includes: Mini 1000, Mk3 Cooper S, Van, and Pick-up',
          },
          {
            value: 'I',
            name: 'Round nose, traditional Mini body style. Includes: Mini 1000, Mk3 Cooper S, Van, and Pick-up',
          },
          {
            value: '2',
            name: 'Clubman, square nose style. Includes: Clubman saloon, Clubman Estate, and 1275GT',
          },
        ],
        5: [{ value: 'N', name: 'Mini 1000' }],
        6: [],
        7: [],
        8: [],
        9: [],
        10: [],
        11: [],
      },
      number: '###',
      last: [{ value: 'A', name: 'Longbridge' }],
    },
  },
  {
    title: '1974-1980',
    value: {
      // 'X-K2S1N-###-A'
      PrimaryExample: {
        1: 'X-',
        2: 'K',
        3: '2S',
        4: '1',
        5: 'N-',
        6: '',
        7: '',
        8: '',
        9: '',
        10: '',
        11: '',
        numbers: '###-',
        last: 'A',
      },
      options: {
        1: [{ value: 'X', name: 'This is simply dismissed by the factory as "non-significant"!' }],
        2: [
          {
            value: 'A',
            name: '[Unknown if this was used. If so, it indicated any of the A-series engines still in production at that time]',
          },
          { value: 'C', name: '1098cc' },
          { value: 'E', name: '1275cc' },
          { value: 'K', name: '848cc' },
          { value: 'L', name: '998cc' },
        ],
        3: [
          {
            value: '2D',
            name: '1275GT 2-door saloon (e.g. X-E2D2 prefix, 1974-1980)',
          },
          {
            value: '2S',
            name: '2-door Saloon (except 1275GT). Bureaucratic bungles often interpret this as 25',
          },
          { value: '2W', name: 'Estate (“2-door Dual Purpose”). Used on X-L2W2 / X-C2W2 Clubman Estate' },
          { value: 'U', name: 'Pick-up (e.g. X-KU1, X-LU1). "U" and "V" can be mistaken one for the other' },
          { value: 'V', name: 'Panel van (e.g. X-KV1, X-LV1). "U" and "V" can be mistaken one for the other' },
        ],
        4: [
          {
            value: '1',
            name: 'Round nose. Includes: Mini 850, Mini 850 City, Mini 850 Special Deluxe, Mini 1000, Van (848cc and 998cc), Mini Special 1098cc, and Pick-up (850cc and 998cc).',
          },
          {
            value: '2',
            name: 'Clubman, square nose style. Includes: Clubman Saloon (998cc Automatic and 1098cc Manual), Clubman Estate (998cc Automatic and 1098cc Manual), and 1275GT.',
          },
        ],
        5: [
          {
            value: 'N',
            name: 'Standard/Special Deluxe trim (non-North America markets). Most common Rest-of-World value.',
          },
          { value: 'A', name: '1970 model year (North America)' },
          { value: 'B', name: '1971 model year (North America)' },
          { value: 'C', name: '1972 model year (North America)' },
          { value: 'D', name: '1973 model year (North America)' },
          { value: 'E', name: '1974 model year (North America)' },
          { value: 'F', name: '1975 model year (North America)' },
          { value: 'G', name: '1976 model year (North America)' },
          { value: 'H', name: '1977 model year (North America)' },
          { value: 'J', name: '1978 model year (North America)' },
          { value: 'L', name: '1979 model year (North America)' },
        ],
        6: [],
        7: [],
        8: [],
        9: [],
        10: [],
        11: [],
      },
      number: '###',
      last: [{ value: 'A', name: 'Longbridge' }],
    },
  },
  {
    title: '1980',
    value: {
      // 'X-K2S1N-###-A'
      PrimaryExample: {
        1: 'X-',
        2: 'K',
        3: '2S',
        4: '1',
        5: 'N-',
        6: '',
        7: '',
        8: '',
        9: '',
        10: '',
        11: '',
        numbers: '###-',
        last: 'A',
      },
      options: {
        1: [{ value: 'X', name: 'This is simply dismissed by the factory as "non-significant"!' }],
        2: [
          { value: 'C', name: '1098cc' },
          { value: 'E', name: '1275cc' },
          { value: 'K', name: '848cc' },
          { value: 'L', name: '998cc' },
        ],
        3: [
          { value: '2D', name: '1275GT' },
          {
            value: '2S',
            name: '2-door Saloon (except 1275GT). Bureaucratic bungles often interpret this as 25',
          },
          { value: '2W', name: 'Estate (“2-door Dual Purpose”)' },
          { value: 'U', name: 'Pick-up. "U" and "V" can be mistaken one for the other.' },
          { value: 'V', name: 'Panel van. "U" and "V" can be mistaken one for the other.' },
        ],
        4: [
          { value: '1', name: 'Round nose, traditional Mini body style.' },
          { value: '2', name: 'Clubman, square nose style.' },
        ],
        5: [{ value: 'N', name: 'Special Deluxe' }],
        6: [],
        7: [],
        8: [],
        9: [],
        10: [],
        11: [],
      },
      number: '###',
      last: [{ value: 'A', name: 'Longbridge' }],
    },
  },
  {
    title: '1980-1985',
    value: {
      // 'SAX-X-K2S1N-###-A'
      PrimaryExample: {
        1: 'SAX-',
        2: '',
        3: '',
        4: 'X-',
        5: 'K',
        6: '2S',
        7: '',
        8: '1',
        9: 'N-',
        10: '',
        11: '',
        numbers: '###-',
        last: 'A',
      },
      options: {
        1: [{ value: 'SAX', name: 'MG - Rover' }],
        2: [],
        3: [],
        4: [{ value: 'X', name: 'This is simply dismissed by the factory as "non-significant"!' }],
        5: [
          { value: 'C', name: '1098cc' },
          { value: 'K', name: '848cc' },
          { value: 'L', name: '998cc' },
        ],
        6: [
          {
            value: '2S',
            name: ' 2-door Saloon (except 1275GT). Bureaucratic bungles often interpret this as 25',
          },
          { value: '2W', name: 'Estate (“2-door Dual Purpose”)' },
          { value: 'G', name: 'P.O. Mail Van' },
          { value: 'U', name: 'Pick-up. "U" and "V" can be mistaken one for the other.' },
          { value: 'V', name: 'Panel van. "U" and "V" can be mistaken one for the other.' },
        ],
        7: [],
        8: [
          { value: '1', name: 'Round nose, traditional Mini body style.' },
          { value: '2', name: 'Clubman, square nose style.' },
        ],
        9: [
          { value: 'N', name: 'HL, Special, HLE, or Mayfair' },
          { value: 'R', name: 'Mini 25' },
          { value: 'S', name: 'Mayfair (left-hand drive - France only)' },
        ],
        10: [],
        11: [],
      },
      number: '###',
      last: [{ value: 'A', name: 'Longbridge' }],
    },
  },
  {
    title: '1985-1990',
    value: {
      //'SAX-X-L2S1N20-###-A'
      PrimaryExample: {
        1: 'SAX-',
        2: '',
        3: '',
        4: 'X-',
        5: 'L',
        6: '2S',
        7: '',
        8: '1',
        9: 'N',
        10: '2',
        11: '0-',
        numbers: '###-',
        last: 'A',
      },
      options: {
        1: [{ value: 'SAX', name: 'MG - Rover' }],
        2: [],
        3: [],
        4: [{ value: 'X', name: 'This is simply dismissed by the factory as "non-significant"!' }],
        5: [{ value: 'L', name: '998cc' }],
        6: [
          {
            value: '2S',
            name: '2-door Saloon. Bureaucratic bungles often interpret this as 25',
          },
        ],
        7: [],
        8: [
          { value: '1', name: 'Round nose, traditional Mini body style (non-catalyst)' },
          { value: '3', name: 'Round nose, catalyst-equipped (1989+ emissions spec, e.g. X-L2S3N/O/S)' },
        ],
        9: [
          { value: 'N', name: 'HLE, or Mayfair (right-hand drive)' },
          { value: 'O', name: 'E, City, or City E' },
          { value: 'S', name: 'Mayfair (left-hand drive, Europe)' },
        ],
        10: [
          {
            value: '2',
            name: '1984-on',
          },
        ],
        11: [
          { value: '0', name: 'Right-hand drive (RHD)' },
          { value: '1', name: 'Left-hand drive (LHD)' },
        ],
      },
      number: '###',
      last: [{ value: 'A', name: 'Longbridge' }],
    },
  },
  {
    title: '1990-on',
    value: {
      //'SAX-XN-N-A-Y-B-B-D-######'
      PrimaryExample: {
        1: 'SAX',
        2: '',
        3: '',
        4: 'XN-',
        5: '',
        6: 'N-',
        7: 'A-',
        8: 'Y-',
        9: 'B-',
        10: 'B-',
        11: 'D-',
        numbers: '######',
        last: '',
      },
      options: {
        1: [{ value: 'SAX', name: 'MG - Rover' }],
        2: [],
        3: [],
        4: [{ value: 'XN', name: 'Mini 1300' }],
        5: [],
        6: [
          { value: 'C', name: 'Cooper / Cooper 1.3i / Cooper MPi (XN-CA prefix, 1990-2000)' },
          { value: 'N', name: 'Sport, Cabriolet, or similar performance/limited-edition trim' },
          { value: 'V', name: 'Kensington' },
          { value: 'W', name: 'HLS, Mayfair, Mayfair 1.3i, MPi (XN-WA prefix)' },
          { value: 'Y', name: 'City, Sprite (XN-YA prefix)' },
        ],
        7: [
          { value: 'A', name: '2-door Saloon' },
          { value: 'B', name: 'Cabriolet' },
        ],
        8: [
          { value: 'D', name: '1300 Carb' },
          { value: 'M', name: '1300 Carb' },
          { value: 'X', name: '1300 SPi (standard compression ratio, 9.4:1)' },
          { value: 'Y', name: '1300 SPi (high compression ratio, 10.1:1)' },
          { value: 'Z', name: '1300 MPi (high compression ratio, 10.1:1)' },
        ],
        9: [
          { value: 'B', name: 'RHD, Manual, 3.105' },
          { value: 'C', name: 'RHD, Manual, 3.21' },
          { value: 'E', name: 'RHD, Manual, 2.76' },
          { value: 'K', name: 'RHD, Automatic' },
          { value: 'M', name: 'LHD, Manual, 3.105' },
          { value: 'N', name: 'LHD, Manual, 3.21' },
          { value: 'R', name: 'LHD, Manual, 2.76' },
          { value: 'Y', name: 'LHD, Automatic' },
        ],
        10: [
          { value: 'A', name: '1300 Special Edition' },
          { value: 'B', name: '1300' },
        ],
        11: [{ value: 'D', name: 'Longbridge' }],
      },
      number: '######',
      last: [],
    },
  },
  {
    // Australian-built Minis (BMC / Leyland Australia, Zetland/Enfield, NSW).
    // Primary 6-character body/type code used on the ID plate, e.g. YMA2S1-####.
    // References: eight-fifty.com, mini.org.au. Note that later Leyland-era cars
    // (Mini K, 1100, Clubman GT) dropped the make letter and used a 5-char code
    // like YG2S1 — that shorter variant is not yet handled here.
    title: '1961-1978 (Australia)',
    value: {
      // YMA2S1-####
      PrimaryExample: {
        1: 'Y',
        2: 'M',
        3: 'A',
        4: '2',
        5: 'S',
        6: '1',
        7: '',
        8: '',
        9: '',
        10: '',
        11: '',
        numbers: '####',
        last: '',
      },
      options: {
        1: [{ value: 'Y', name: 'Origin of manufacture: Australia (BMC / Leyland Australia, Zetland NSW)' }],
        2: [
          { value: 'M', name: 'Morris (Morris 850, Mini Deluxe, Mini Minor, Mini-Matic Mk1)' },
          { value: 'K', name: 'Morris Cooper / Cooper S (997cc, 998cc, or 1275cc engines)' },
          { value: 'J', name: 'Commercial — Van or Utility body (e.g. YJBAV1R)' },
        ],
        3: [
          { value: 'A', name: 'A-series engine, 800–999cc (848cc or 998cc)' },
          { value: 'G', name: 'A-series engine, 1275cc (Cooper S Mk1, typically YKG2S2)' },
        ],
        4: [{ value: '2', name: '2-door body' }],
        5: [
          { value: 'S', name: 'Saloon (Sedan)' },
          { value: 'V', name: 'Van / Commercial body' },
        ],
        6: [
          { value: '1', name: 'Mk1: Morris 850 (YMA2S1) or Morris Cooper (YKA2S1), 1961–1966' },
          { value: '2', name: 'Mk2: Morris Mini Deluxe (YMA2S2) or Cooper S Mk1 (YKG2S2), 1966–1969' },
          { value: '3', name: 'Mini Minor / Mini 1100 / Deluxe update (YMA2S3), 1969+' },
          { value: '4', name: 'Mini-Matic Mk1 (YMA2S4) or Cooper S Mk2, 1967–1969' },
          { value: '5', name: 'Mini-Matic Mk2 (YA2S5)' },
          { value: '8', name: 'Clubman GT (YG2S8)' },
        ],
        7: [],
        8: [],
        9: [],
        10: [],
        11: [],
      },
      number: '####',
      last: [],
    },
  },
];
