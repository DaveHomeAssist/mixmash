(function attachMixKitSave(global) {
  'use strict';

  function encodeCode(json) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(json)));
    return Buffer.from(json, 'utf8').toString('base64');
  }

  function decodeCode(code) {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(code)));
    return Buffer.from(code, 'base64').toString('utf8');
  }

  // Shared per-game persistence: versioned envelope in localStorage plus
  // portable base64 save codes (the MarsScape relocation format).
  function createSaveStore(namespace, opts) {
    opts = opts || {};
    var version = opts.version || 1;
    var storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    var migrate = opts.migrate || null;

    function unwrap(parsed) {
      if (parsed === null || typeof parsed !== 'object') return null;
      if (parsed.ns === undefined && parsed.state === undefined) return parsed; // legacy raw state
      if (parsed.ns !== namespace) return null;
      var state = parsed.state;
      if (migrate && typeof parsed.v === 'number' && parsed.v < version) {
        state = migrate(state, parsed.v);
      }
      return state === undefined ? null : state;
    }

    return {
      key: namespace,
      load: function () {
        if (!storage) return null;
        try { return unwrap(JSON.parse(storage.getItem(namespace) || 'null')); }
        catch (e) { return null; }
      },
      save: function (state) {
        if (!storage) return false;
        try {
          storage.setItem(namespace, JSON.stringify({ ns: namespace, v: version, savedAt: new Date().toISOString(), state: state }));
          return true;
        } catch (e) { return false; }
      },
      clear: function () {
        if (!storage) return;
        try { storage.removeItem(namespace); } catch (e) {}
      },
      exportCode: function () {
        if (!storage) return null;
        var raw = null;
        try { raw = storage.getItem(namespace); } catch (e) {}
        return raw ? encodeCode(raw) : null;
      },
      importCode: function (code) {
        var state = null;
        try { state = unwrap(JSON.parse(decodeCode(String(code || '').trim()))); }
        catch (e) { return null; }
        if (state === null) return null;
        this.save(state);
        return state;
      }
    };
  }

  var api = { createSaveStore: createSaveStore, encodeCode: encodeCode, decodeCode: decodeCode };
  if (global) global.MixKitSave = api;
})(typeof window !== 'undefined' ? window : globalThis);
