export enum ARCHIVE_TYPES {
  ADVERT = 'advert',
  CATALOGUES = 'catalogues',
  MANUAL = 'manual',
  GENERIC = 'generic',
  TUNING = 'tuning',
}

export interface SubmissionInfo {
  title: string;
  url: string;
  body: string;
  code: string;
}

export function humanFileSize(bytes: number, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

  return bytes.toFixed(dp) + ' ' + units[u];
}

export function generateArchiveSubmissionMailto(type: ARCHIVE_TYPES, info: SubmissionInfo): string {
  if (type !== ARCHIVE_TYPES.GENERIC) {
    return `mailto:classicminidiy@gmail.com?subject=Archive%20Submission%20-%20${type}%20-%20${info.code}&body=I%20have%20a%20change%20or%20contribution%20to%20make%20to%20part%20of%20your%20Classic%20Mini%20Archive.%20%0A%0AArchive%20-%20${type}%0A%0AReference%20Page%3A%20%0ATitle%20-%20${info.title}%0AUrl%20-%20${info.url}%0ADescription%20-%20${info.body}%0ACode%20-%20${info.code}%0A%0ANew%20Information%3A%0A%3CPUT%20ALL%20YOUR%20NEW%20INFO%20HERE%3E%0A%0APlease%20attach%20any%20new%20files%20you%20would%20like%20me%20to%20add%20to%20this%20page%20as%20well%2C%20to%20your%20email.`;
  } else {
    return `mailto:classicminidiy@gmail.com?subject=Archive%20Submission%20-%20General`;
  }
}

export async function shareArchiveItem(title: string = '', url: string = '/archive/manuals') {
  try {
    await window.navigator.share({ url: `https://classicminidiy.com${url}` });
  } catch (error) {
    console.error('cannot share', error);
  }
}

export async function shareWheelItem(title: string = '', uuid: string = '') {
  try {
    await window.navigator.share({ title, url: `https://classicminidiy.com/archive/wheels/${uuid}` });
  } catch (error) {
    console.error('cannot share', error);
  }
}

export async function shareColorItem(title: string = '', color: string = '') {
  try {
    await window.navigator.share({ title, url: `https://classicminidiy.com/archive/colors/${color}` });
  } catch (error) {
    console.error('cannot share', error);
  }
}

export async function submitArchiveFile(
  archive: ARCHIVE_TYPES = ARCHIVE_TYPES.MANUAL,
  title: string = '',
  url: string = '',
  code: string = '',
  body: string = ''
) {
  try {
    window.location.href = await generateArchiveSubmissionMailto(archive, {
      title,
      url,
      body,
      code,
    });
  } catch (error) {
    console.error('cannot contribute', error);
  }
}

export function determineArchiveType(path: string) {
  if (path.includes('manuals')) {
    return ARCHIVE_TYPES.MANUAL;
  } else if (path.includes('adverts')) {
    return ARCHIVE_TYPES.ADVERT;
  } else {
    return ARCHIVE_TYPES.GENERIC;
  }
}
