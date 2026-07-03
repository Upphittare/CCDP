(function() {
  const MELB_LAT = -37.8136;
  const MELB_LNG = 144.9631;

  function deg2rad(d) { return d * Math.PI / 180; }
  function rad2deg(r) { return r * 180 / Math.PI; }

  function getMelbSunTimes(date) {
    const yearStart = new Date(date.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((date - yearStart) / 86400000);

    const lngHour = MELB_LNG / 15;
    const decl = 23.45 * Math.sin(deg2rad(360 / 365 * (dayOfYear - 81)));

    function computeUTC(isRise) {
      const t = dayOfYear + ((isRise ? 6 : 18) - lngHour) / 24;
      const M = (0.9856 * t) - 3.289;
      let L = M + (1.916 * Math.sin(deg2rad(M))) + (0.020 * Math.sin(deg2rad(2 * M))) + 282.634;
      L = ((L % 360) + 360) % 360;
      let RA = rad2deg(Math.atan(0.91764 * Math.tan(deg2rad(L))));
      RA = ((RA % 360) + 360) % 360;
      const Lquadrant = Math.floor(L / 90) * 90;
      const RAquadrant = Math.floor(RA / 90) * 90;
      RA = RA + (Lquadrant - RAquadrant);
      RA = RA / 15;
      const sinDec = 0.39782 * Math.sin(deg2rad(L));
      const cosDec = Math.cos(Math.asin(sinDec));
      const zenith = 90.833;
      const cosH = (Math.cos(deg2rad(zenith)) - (sinDec * Math.sin(deg2rad(MELB_LAT)))) / (cosDec * Math.cos(deg2rad(MELB_LAT)));
      if (cosH > 1 || cosH < -1) return null;
      let H = isRise ? 360 - rad2deg(Math.acos(cosH)) : rad2deg(Math.acos(cosH));
      H = H / 15;
      const T = H + RA - (0.06571 * t) - 6.622;
      let UT = T - lngHour;
      UT = ((UT % 24) + 24) % 24;
      return UT;
    }

    return { sunriseUTC: computeUTC(true), sunsetUTC: computeUTC(false) };
  }

  function isMelbDaytime() {
    const now = new Date();
    const melbNow = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
    const { sunriseUTC, sunsetUTC } = getMelbSunTimes(now);
    if (sunriseUTC === null || sunsetUTC === null) return true;

    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    let melbOffsetHours = (melbNow.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) / 3600000;

    let melbHours = utcHours + melbOffsetHours;
    melbHours = ((melbHours % 24) + 24) % 24;

    let sunriseLocal = sunriseUTC + melbOffsetHours;
    let sunsetLocal = sunsetUTC + melbOffsetHours;
    sunriseLocal = ((sunriseLocal % 24) + 24) % 24;
    sunsetLocal = ((sunsetLocal % 24) + 24) % 24;

    if (sunsetLocal > sunriseLocal) {
      return melbHours >= sunriseLocal && melbHours < sunsetLocal;
    } else {
      return melbHours >= sunriseLocal || melbHours < sunsetLocal;
    }
  }

  function getEffectiveTheme(mode) {
    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return isMelbDaytime() ? 'light' : 'dark';
  }

  function getStoredMode() {
    try { return localStorage.getItem('themeMode') || 'auto'; }
    catch (e) { return 'auto'; }
  }

  function setStoredMode(mode) {
    try { localStorage.setItem('themeMode', mode); } catch (e) {}
  }

  function applyTheme() {
    const mode = getStoredMode();
    const effective = getEffectiveTheme(mode);
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-mode', mode);

    document.querySelectorAll('iframe').forEach(f => {
      try {
        f.contentWindow.postMessage({ type: 'theme-update', theme: effective, mode }, '*');
      } catch (e) {}
    });

    return { effective, mode };
  }

  function cycleMode() {
    const order = ['auto', 'system', 'light', 'dark'];
    const current = getStoredMode();
    const next = order[(order.indexOf(current) + 1) % order.length];
    setStoredMode(next);
    return applyTheme();
  }

  window.JournalTheme = {
    apply: applyTheme,
    cycle: cycleMode,
    getMode: getStoredMode,
    isMelbDaytime: isMelbDaytime
  };

  applyTheme();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredMode() === 'system') applyTheme();
  });

  setInterval(() => {
    if (getStoredMode() === 'auto') applyTheme();
  }, 60000);

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'theme-request') {
      const mode = getStoredMode();
      const effective = getEffectiveTheme(mode);
      try {
        e.source.postMessage({ type: 'theme-update', theme: effective, mode }, '*');
      } catch (err) {}
    }
  });
})();
