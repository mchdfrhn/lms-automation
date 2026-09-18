/**
 * Parser teks opsi pertemuan Civitas LMS
 * Contoh teks input: "2. (22 Sep 2026, 19:00 - 20:30 WIB)"
 */
function parseMeetingOption(text) {
    const regex = /(\d+)\.\s*\(\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*,\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/;
    const match = text.match(regex);
    if (!match) return null;

    const monthMap = {
        'jan': 0, 'januari': 0, 'january': 0,
        'feb': 1, 'februari': 1, 'february': 1,
        'mar': 2, 'maret': 2, 'march': 2,
        'apr': 3, 'april': 3,
        'mei': 4, 'may': 4,
        'jun': 5, 'juni': 5, 'june': 5,
        'jul': 6, 'juli': 6, 'july': 6,
        'agu': 7, 'agustus': 7, 'aug': 7, 'august': 7,
        'sep': 8, 'september': 8,
        'okt': 9, 'oktober': 9, 'oct': 9, 'october': 9,
        'nov': 10, 'november': 10,
        'des': 11, 'desember': 11, 'dec': 11, 'december': 11
    };

    const monthStr = match[3].toLowerCase();
    const monthIndex = monthMap[monthStr] !== undefined ? monthMap[monthStr] : 8;

    return {
        meetingNumber: parseInt(match[1], 10),
        day: parseInt(match[2], 10),
        monthIndex: monthIndex,
        monthName: match[3],
        year: parseInt(match[4], 10),
        startHour: parseInt(match[5], 10),
        startMinute: parseInt(match[6], 10),
        endHour: parseInt(match[7], 10),
        endMinute: parseInt(match[8], 10),
        raw: text.trim()
    };
}

module.exports = {
    parseMeetingOption
};
