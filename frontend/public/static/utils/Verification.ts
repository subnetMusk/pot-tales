export function generateLuhn(cookie : string) : string {
    let sum : number = 0;
    for (let i : number = 0; i < cookie.length; i++) {
        if (i % 2 == 0) {
            sum += parseInt(cookie[i]);
        } else {
            sum += parseInt(cookie[i]) * 2;
        }
    }
    cookie += String(sum % 10);
    return cookie;
}
export function verifyLuhn(cookie : string) : boolean {
    let sum : number = 0;
    for (let i : number = 0; i < cookie.length - 1; i++) {
        if (i % 2 == 0) {
            sum += parseInt(cookie[i]);
        } else {
            sum += parseInt(cookie[i]) * 2;
        }
    }
    return String(sum % 10) == cookie.charAt(cookie.length - 1);
}