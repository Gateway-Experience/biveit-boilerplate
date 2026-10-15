import _ from 'lodash';
import { formatInTimeZone } from 'date-fns-tz';
import { Buffer } from 'buffer';

type ShareOptions = {
  title?: string;
  text?: string;
  url: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Uses the native share sheet where it exists (mostly mobile), otherwise falls back to
// copying the url. Resolves either way, so the caller can't tell which path ran — if that
// matters, have it return something.
async function handleShare({ title, text, url }: ShareOptions) {
  // If on mobile..
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (e) {
      // The user dismissing the sheet rejects the promise; that's not a failure, and we
      // shouldn't fall through to copying behind their back.
      if (_.get(e, 'name') === 'AbortError') {
        return;
      }
    }
  }
  // Else just copy to clipboard.
  await navigator.clipboard.writeText(url);
  // The caller might want to do something like notifying the text is copied now.
}

function parseIntSafe(val: string | number) {
  const res = parseInt(String(val));
  if (isNaN(res) || res < 0) {
    return 0;
  }
  return res;
}

function isValidPhoneNumber(phone: string) {
  return /^(03|05|07|08|09|01[2|6|8|9])([0-9]{8})$/.test(phone);
}

/*
 * Random sampling stuff.
 */

function _cyrb128(str: string) {
  let h1 = 1779033703, h2 = 3144134277,
    h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= (h2 ^ h3 ^ h4), h2 ^= h1, h3 ^= h1, h4 ^= h1;
  return [h1>>>0, h2>>>0, h3>>>0, h4>>>0];
}

function _mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], seed?: string) {
  const rng = _.isNil(seed) ? Math.random : _mulberry32(_cyrb128(seed)[0]);

  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const x = newArr[i];
    newArr[i] = newArr[j];
    newArr[j] = x;
  }

  return newArr;
}

function choose<T>(arr: T[], seed?: string) {
  const rng = _.isNil(seed) ? Math.random : _mulberry32(_cyrb128(seed)[0]);

  return arr[Math.floor(rng() * arr.length)];
}

/*
 * End of random sampling section.
 */

/*
 * Encryption/decryption stuff. Used to obfuscate data in api calls.
 * Usually backend will encrypt data and frontend will decrypt them.
 * Key has to be revealed in frontend side but obfuscation should provide some discouragement.
 */

function _alignString(inputString: string, length: number, options: { padCharacter?: string } = {}) {
  const padChar = _.get(options, 'padCharacter', '0');
  if (inputString.length < length) {
    // Pad the string with the provided character
    return inputString.padEnd(length, padChar);
  } else {
    // Truncate the string to the maximum length
    return inputString.slice(0, length);
  }
}

async function decryptData(encryptedData: { iv: string; encryptedData: string }, key?: string) {
  if (!key) {
    return encryptedData;
  }
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    Buffer.from(_alignString(key, 32)),
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  );
  const decryptedData = await window.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: Buffer.from(encryptedData.iv, 'hex') },
    cryptoKey,
    Buffer.from(encryptedData.encryptedData, 'hex'),
  );
  const decodedData = new TextDecoder().decode(decryptedData);
  return JSON.parse(decodedData);
}

async function encryptData(data: unknown, key?: string) {
  if (!key) {
    return data;
  }
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    Buffer.from(_alignString(key, 32)),
    { name: 'AES-CBC' },
    false,
    ['encrypt'],
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    Buffer.from(JSON.stringify(data), 'utf8'),
  );
  return {
    iv: Buffer.from(iv).toString('hex'),
    encryptedData: Buffer.from(encrypted).toString('hex'),
  };
}

/*
 * End of encryption/decryption section.
 */

/*
 * Formatting stuff.
 */

function formatDate(dateRaw: string | number | Date) {
  const date = new Date(dateRaw); // or any other date
  const timeZone = 'Asia/Ho_Chi_Minh'; // Vietnam's timezone
  const formattedDate = formatInTimeZone(date, timeZone, 'dd/MM/yyyy HH:mm:ss');
  return formattedDate;
}

function formatNumber(num: number | string) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pruneVietnameseAccentMarks(str: string) {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g,'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,'y');
  str = str.replace(/đ/g,'d');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  // Some system encode vietnamese combining accent as individual utf-8 characters
  // Một vài bộ encode coi các dấu mũ, dấu chữ như một kí tự riêng biệt nên thêm hai dòng này
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ''); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
  str = str.replace(/\u02C6|\u0306|\u031B/g, ''); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư
  return str;
}

function itemListStrToArray(str: string) {
  return _(str)
    .split(/\s+/g)
    .reject(code => code === '')
    .value();
}

/*
 * End of formatting section.
 */

export {
  pruneVietnameseAccentMarks,
  itemListStrToArray,
  sleep,
  parseIntSafe,
  shuffle,
  isValidPhoneNumber,
  choose,
  encryptData,
  decryptData,
  formatDate,
  formatNumber,
  handleShare,
};
