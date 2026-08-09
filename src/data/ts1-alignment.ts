export type Ts1Section =
  | 'Merced to Madera'
  | 'CVY'
  | 'CP1'
  | 'CP2-3'
  | 'CP4'
  | 'Poplar Ave to Bakersfield';

export type Subdivision = 'C' | 'S' | 'D';

export type Ts1Segment = {
  section: Ts1Section;
  name: string;
  startSta: number;
  endSta: number;
  aheadSta: number | null;
  subdivision: Subdivision;
  startMp: number;
  endMp: number;
  lengthFt: number;
  lengthMi: number;
};

/**
 * Hand transcription of the length-bearing IOS rows in CAHSRA TS1 3.0,
 * “Alignment Segments and Lengths”, dated 2019-05-01. Station values are
 * engineering feet (SSSS+FF.FF => SSSSFF.FF). Published lengths and
 * mileposts remain verbatim even where rounding differs from station delta.
 */
export const TS1_SEGMENTS: Ts1Segment[] = [
  { section: 'Merced to Madera', name: 'Ranch Road to Merced / North Merced Corridor', startSta: 606614.09, endSta: 565500, aheadSta: 1565500, subdivision: 'C', startMp: 124, endMp: 132, lengthFt: 41114, lengthMi: 7.8 },
  { section: 'Merced to Madera', name: 'Ranch Rd → CP San Joaquin, along SR 152 to Road 11 Wye', startSta: 1565500, endSta: 1531700, aheadSta: null, subdivision: 'C', startMp: 132, endMp: 139, lengthFt: 33800, lengthMi: 6.4 },
  { section: 'CVY', name: 'CP San Joaquin → CP Divide, along SR 152 to Road 11 Wye', startSta: 1531700, endSta: 1500929.85, aheadSta: 647700, subdivision: 'C', startMp: 139, endMp: 144, lengthFt: 30770, lengthMi: 5.8 },
  { section: 'CVY', name: 'CP Divide → CP1, along SR 152 to Road 11 Wye', startSta: 647700, endSta: 717185.19, aheadSta: 962039.57, subdivision: 'S', startMp: 144.5, endMp: 158, lengthFt: 69485, lengthMi: 13.2 },
  { section: 'CP1', name: 'CP1 Extension (60% design, Feb 2019)', startSta: 962039.57, endSta: 982800, aheadSta: null, subdivision: 'S', startMp: 158, endMp: 162, lengthFt: 20760, lengthMi: 3.9 },
  { section: 'CP1', name: 'Track Guideway Package 1 (RFC Sep 2017)', startSta: 982800, endSta: 1030400, aheadSta: null, subdivision: 'S', startMp: 162, endMp: 171, lengthFt: 47600, lengthMi: 9 },
  { section: 'CP1', name: 'Track Guideway Package 2 (RFC Dec 2017)', startSta: 1030400, endSta: 1058010.38, aheadSta: 1058022.31, subdivision: 'S', startMp: 171, endMp: 176, lengthFt: 27610, lengthMi: 5.2 },
  { section: 'CP1', name: 'Track Guideway Package 2 (cont.)', startSta: 1058022.31, endSta: 1069150, aheadSta: null, subdivision: 'S', startMp: 176, endMp: 178, lengthFt: 11128, lengthMi: 2.1 },
  { section: 'CP1', name: 'Caltrans Segment (RFC Jan 2016)', startSta: 1069150, endSta: 1082560, aheadSta: null, subdivision: 'S', startMp: 178, endMp: 180, lengthFt: 13410, lengthMi: 2.5 },
  { section: 'CP1', name: 'Track Guideway Package 3 (RFC Feb 2018)', startSta: 1082560, endSta: 1103000, aheadSta: null, subdivision: 'S', startMp: 180, endMp: 184, lengthFt: 20440, lengthMi: 3.9 },
  { section: 'CP1', name: 'Track Guideway Package 4 (RFC Feb 2018)', startSta: 1103000, endSta: 1129998.9, aheadSta: 58730.67, subdivision: 'S', startMp: 184, endMp: 189, lengthFt: 26999, lengthMi: 5.1 },
  { section: 'CP2-3', name: 'Segment 1 North (RFC Oct 2017)', startSta: 58730.67, endSta: 107500, aheadSta: null, subdivision: 'S', startMp: 189, endMp: 199, lengthFt: 48769, lengthMi: 9.2 },
  { section: 'CP2-3', name: 'Segment 1 South (RFC Dec 2017)', startSta: 107500, endSta: 159500, aheadSta: null, subdivision: 'S', startMp: 199, endMp: 209, lengthFt: 52000, lengthMi: 9.8 },
  { section: 'CP2-3', name: 'Segment 2 North (90% design, Feb 2017)', startSta: 159500, endSta: 173100, aheadSta: null, subdivision: 'S', startMp: 209, endMp: 211, lengthFt: 13600, lengthMi: 2.6 },
  { section: 'CP2-3', name: 'Segment 2 Combined Middle and South (RFC Mar 2018)', startSta: 173100, endSta: 266500, aheadSta: null, subdivision: 'S', startMp: 211, endMp: 229, lengthFt: 93400, lengthMi: 17.7 },
  { section: 'CP2-3', name: 'Segment 3 North (RFC Dec 2017)', startSta: 266500, endSta: 344900, aheadSta: null, subdivision: 'S', startMp: 229, endMp: 244, lengthFt: 78400, lengthMi: 14.8 },
  { section: 'CP2-3', name: 'Segment 3 South (RFC Mar 2018)', startSta: 344900, endSta: 404555.69, aheadSta: 1476922.54, subdivision: 'S', startMp: 244, endMp: 255, lengthFt: 59656, lengthMi: 11.3 },
  { section: 'CP4', name: 'Alignment A1 (RFC Jun 2018)', startSta: 1476922.54, endSta: 1525907.86, aheadSta: null, subdivision: 'S', startMp: 255, endMp: 264, lengthFt: 48985, lengthMi: 9.3 },
  { section: 'CP4', name: 'Alignment L1 (RFC Jun 2018)', startSta: 1525907.86, endSta: 1542688.18, aheadSta: null, subdivision: 'S', startMp: 264, endMp: 267, lengthFt: 16780, lengthMi: 3.2 },
  { section: 'CP4', name: 'Alignment WS1 (RFC Sep 2018)', startSta: 1542688.18, endSta: 1561000, aheadSta: null, subdivision: 'S', startMp: 267, endMp: 271, lengthFt: 18312, lengthMi: 3.5 },
  { section: 'CP4', name: 'Alignment WS1 (RFC Oct 2018)', startSta: 1561000, endSta: 1588438.6, aheadSta: 588000, subdivision: 'S', startMp: 271, endMp: 276, lengthFt: 27439, lengthMi: 5.2 },
  { section: 'Poplar Ave to Bakersfield', name: 'Fresno–Bakersfield Locally Generated Alternative (FB–LGA)', startSta: 588000, endSta: 685600, aheadSta: 685600, subdivision: 'S', startMp: 276, endMp: 295, lengthFt: 97600, lengthMi: 18.5 },
  { section: 'Poplar Ave to Bakersfield', name: 'FB–LGA (Desert Subdivision)', startSta: 685600, endSta: 710104.43, aheadSta: null, subdivision: 'D', startMp: 295, endMp: 299, lengthFt: 24504, lengthMi: 4.6 },
];

export const IOS_AXIS_MILES = 175;
export const BAKERSFIELD_IOS_MILE = 171;
