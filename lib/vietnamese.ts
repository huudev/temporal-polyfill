import type { ISODate } from "./internaltypes";

export type VietNameseMonthInfo = Map<string, { monthIndex: number; daysInMonth: number }>
// Timezone offset for Vietnam (UTC+7)
const VIETNAM_TZ_OFFSET = 7;
const vietnameseMonthListCache = new Map<number, VietNameseMonthInfo>();
export function getVietnameseMonthList(calendarYear: number): VietNameseMonthInfo {
    if (calendarYear === undefined) {
        throw new TypeError('Thiếu năm (Missing year)');
    }

    const cached = vietnameseMonthListCache.get(calendarYear);
    if (cached) return cached;

    const result: VietNameseMonthInfo = new Map();

    // Kiểm tra CẢ HAI khoảng để tìm tháng nhuận
    // 1. Từ tháng 11 năm (X-1) đến tháng 11 năm X (cho tháng 1-10)
    // 2. Từ tháng 11 năm X đến tháng 11 năm (X+1) (cho tháng 11-12)
    const a11_prev = getLunarMonth11(calendarYear - 1);
    const a11_curr = getLunarMonth11(calendarYear);
    const a11_next = getLunarMonth11(calendarYear + 1);

    // Xác định khoảng nào có tháng nhuận và tháng nhuận đó thuộc tháng nào
    let leapMonthIndex = -1; // Vị trí của tháng nhuận (0-12)
    let a11, k;

    // Kiểm tra khoảng 1 trước (tháng 1-10)
    if (a11_curr - a11_prev > 365) {
        a11 = a11_prev;
        k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);

        for (let i = 0; i < 13; i++) {
            const monthStart = getNewMoonDay(k + 2 + i);
            const nextMonthStart = getNewMoonDay(k + 2 + i + 1);

            const sunLong1 = getSunLongitude(monthStart);
            const sunLong2 = getSunLongitude(nextMonthStart);

            if (sunLong1 === sunLong2) {
                leapMonthIndex = i;
                break;
            }
        }
    } else if (a11_next - a11_curr > 365) {
        // Kiểm tra khoảng 2 (tháng 11-12)

        a11 = a11_curr;
        k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);

        // Trong khoảng này, cần kiểm tra từ tháng 11 (k+0) đến tháng 1 năm sau
        // k+0: tháng 11 chính
        // k+1: có thể là tháng 11bis hoặc tháng 12
        // k+2: tháng 12 hoặc tháng 1 năm sau
        for (let i = 0; i < 4; i++) {
            const monthStart = getNewMoonDay(k + i);
            const nextMonthStart = getNewMoonDay(k + i + 1);

            const sunLong1 = getSunLongitude(monthStart);
            const sunLong2 = getSunLongitude(nextMonthStart);

            if (sunLong1 === sunLong2 && i >= 1) {
                // Tháng nhuận tìm thấy
                // k+1 (i=1): Tháng 11bis → trong vòng lặp chính, đây là i=11 (giữa tháng 11 và 12)
                // k+2 (i=2): Tháng 12bis → trong vòng lặp chính, đây là i=12 (sau tháng 12)
                if (i === 1) {
                    leapMonthIndex = 11; // Tháng 11bis nằm ở vị trí i=11 trong vòng lặp chính
                } else if (i === 2) {
                    leapMonthIndex = 12; // Tháng 12bis nằm ở vị trí i=12 trong vòng lặp chính
                }
                break;
            }
        }
    } else {
        a11 = a11_prev;
        k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    }

    const totalMonths = leapMonthIndex >= 0 ? 13 : 12;
    let monthIndex = 1;
    let currentLunarMonth = 1;

    for (let i = 0; i < totalMonths; i++) {
        const monthStart = getNewMoonDay(k + 2 + i);
        const nextMonthStart = getNewMoonDay(k + 2 + i + 1);
        const daysInMonth = nextMonthStart - monthStart;

        const isThisLeapMonth = i === leapMonthIndex;
        const isNextLeapMonth = i + 1 === leapMonthIndex;

        let monthKey: string;
        if (isThisLeapMonth) {
            monthKey = `${currentLunarMonth}bis`;
        } else {
            monthKey = `${currentLunarMonth}`;
        }

        result.set(monthKey, {
            monthIndex,
            daysInMonth: daysInMonth
        });

        monthIndex++;

        // - Nếu tháng tiếp theo là tháng nhuận: KHÔNG tăng (để tháng nhuận dùng lại số hiện tại)
        if (!isNextLeapMonth) {
            // Tháng thường và tháng tiếp theo không phải tháng nhuận, tăng lên
            currentLunarMonth++;
            if (currentLunarMonth > 12) {
                currentLunarMonth = 1;
            }
        }
        // Nếu tháng tiếp theo là tháng nhuận: không làm gì (giữ nguyên currentLunarMonth)
    }

    vietnameseMonthListCache.set(calendarYear, result);
    return result;
}

// Convert Gregorian date to Julian Day Number
function jdFromDate(year: number, month: number, day: number): number {
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    let jd =
        day +
        Math.floor((153 * m + 2) / 5) +
        365 * y +
        Math.floor(y / 4) -
        Math.floor(y / 100) +
        Math.floor(y / 400) -
        32045;

    if (jd < 2299161) {
        jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
    }
    return jd;
}

// Convert Julian Day Number to Gregorian date
function jdToDate(jd: number): { year: number; month: number; day: number } {
    let a, b, c, d, e, m;

    if (jd > 2299160) {
        // After 5/10/1582, Gregorian calendar
        a = jd + 32044;
        b = Math.floor((4 * a + 3) / 146097);
        c = a - Math.floor((b * 146097) / 4);
    } else {
        b = 0;
        c = jd + 32082;
    }

    d = Math.floor((4 * c + 3) / 1461);
    e = c - Math.floor((1461 * d) / 4);
    m = Math.floor((5 * e + 2) / 153);

    const day = e - Math.floor((153 * m + 2) / 5) + 1;
    const month = m + 3 - 12 * Math.floor(m / 10);
    const year = b * 100 + d - 4800 + Math.floor(m / 10);

    return { year, month, day };
}

// Calculate sun longitude (in degrees) at given Julian Day
function getSunLongitude(jdn: number): number {
    let T = (jdn - 2451545.5 - VIETNAM_TZ_OFFSET / 24) / 36525;
    let T2 = T * T;
    let dr = Math.PI / 180;
    let M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    let L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
    let L = L0 + DL;
    L = L * dr;
    L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
    return Math.floor((L / Math.PI) * 6);
}

// Calculate new moon day (day of conjunction)
function getNewMoonDay(k: number): number {
    const T = k / 1236.85; // Time in Julian centuries from 1900 January 0.5
    const T2 = T * T;
    const T3 = T2 * T;
    const dr = Math.PI / 180;

    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr); // Mean new moon

    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3; // Sun's mean anomaly
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3; // Moon's mean anomaly
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3; // Moon's argument of latitude

    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));

    let deltat;
    if (T < -11) {
        deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
    } else {
        deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
    }

    const JdNew = Jd1 + C1 - deltat;
    return Math.floor(JdNew + 0.5 + VIETNAM_TZ_OFFSET / 24);
}

// Find lunar month 11 of a given year (contains winter solstice)
function getLunarMonth11(yy: number): number {
    const off = jdFromDate(yy, 12, 31) - 2415021;
    const k = Math.floor(off / 29.530588853);
    let nm = getNewMoonDay(k);
    const sunLong = getSunLongitude(nm);

    if (sunLong >= 9) {
        nm = getNewMoonDay(k - 1);
    }
    return nm;
}

// Find leap month in a lunar year
function getLeapMonthOffset(a11: number): number {
    let k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last = 0;
    let i = 1;
    let arc = getSunLongitude(getNewMoonDay(k + i));
    do {
        last = arc;
        i++;
        arc = getSunLongitude(getNewMoonDay(k + i));
    } while (arc !== last && i < 14);
    return i - 1;
}

// Convert ISO date to Vietnamese lunar date
export function isoToVietnameseLunar(isoDate: ISODate): { year: number; month: number; day: number; leap: boolean } {
    const { year, month, day } = isoDate;
    const dayNumber = jdFromDate(year, month, day);
    const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = getNewMoonDay(k + 1);

    // Tìm ngày sóc (mồng 1) đúng: phải <= dayNumber
    if (monthStart > dayNumber) {
        monthStart = getNewMoonDay(k);
    }

    // Kiểm tra thêm lần nữa vì có thể k ban đầu đã sai
    if (monthStart > dayNumber) {
        monthStart = getNewMoonDay(k - 1);
    }

    let a11 = getLunarMonth11(year);
    let b11 = a11;
    let lunarYear;

    if (a11 >= monthStart) {
        lunarYear = year;
        a11 = getLunarMonth11(year - 1);
    } else {
        lunarYear = year + 1;
        b11 = getLunarMonth11(year + 1);
    }

    const lunarDay = dayNumber - monthStart + 1;
    const diff = Math.floor((monthStart - a11) / 29);
    let lunarLeap = false;
    let lunarMonth = diff + 11;

    if (b11 - a11 > 365) {
        const leapMonthDiff = getLeapMonthOffset(a11);
        if (diff >= leapMonthDiff) {
            lunarMonth = diff + 10;
            if (diff === leapMonthDiff) {
                lunarLeap = true;
            }
        }
    }

    if (lunarMonth > 12) {
        lunarMonth = lunarMonth - 12;
    }
    if (lunarMonth >= 11 && diff < 4) {
        lunarYear -= 1;
    }

    return { year: lunarYear, month: lunarMonth, day: lunarDay, leap: lunarLeap };
}

// Convert Vietnamese lunar date to ISO date
export function vietnameseLunarToIso(lunarYear: number, lunarMonth: number, lunarDay: number, lunarLeap: boolean): ISODate {
    let a11, b11;

    if (lunarMonth < 11) {
        a11 = getLunarMonth11(lunarYear - 1);
        b11 = getLunarMonth11(lunarYear);
    } else {
        a11 = getLunarMonth11(lunarYear);
        b11 = getLunarMonth11(lunarYear + 1);
    }

    const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
    let off = lunarMonth - 11;

    if (off < 0) {
        off += 12;
    }

    if (b11 - a11 > 365) {
        const leapOff = getLeapMonthOffset(a11);
        let leapMonth = leapOff - 2;
        if (leapMonth < 0) {
            leapMonth += 12;
        }
        if (lunarLeap && lunarMonth !== leapMonth) {
            return { year: 0, month: 0, day: 0 }; // Invalid leap month
        } else if (lunarLeap || off >= leapOff) {
            off += 1;
        }
    }

    const monthStart = getNewMoonDay(k + off);
    const isoJd = monthStart + lunarDay - 1;

    return jdToDate(isoJd);
}