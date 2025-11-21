import moment from 'moment';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export function getCurrentDate() {
    return moment();
}

export function getCurrentDateString() {
    return getCurrentDate().format('YYYY-MM-DD');
}

export function getCurrentTimeString() {
    return getCurrentDate().format('MMMM Do YYYY, h:mm:ss a');
}

export function getCreationTimeDateString(
    creationTimeMs: string | number, // explicit type
) {
    const d = new Date(
        parseInt(creationTimeMs.toString()) + (1000 * 60 * 60 * (5.5 - 14))
    );
    return `RT-${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}



// import moment from 'moment';

// const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// export function getCurrentDate() {
//     return moment();
// }

// export function getCurrentDateString() {
//     return getCurrentDate().format('YYYY-MM-DD');
// }

// export function getCurrentTimeString() {
//     return getCurrentDate().format('MMMM Do YYYY, h:mm:ss a')
// }

// export function getCreationTimeDateString(
//     creationTimeMs, /* could be string or number */
// ) {
//     let d = (new Date(parseInt(creationTimeMs) + (1000 * 60 * 60 * (5.5 - 14))));
//     return 'RT-' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
// }
