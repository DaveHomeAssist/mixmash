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

  function MixKitSaveError(status, message) {
    var err = new Error(message || status);
    err.name = 'MixKitSaveError';
    err.status = status;
    return err;
  }

  // Reading window.localStorage throws when the browser blocks site data; play then
  // continues without saving instead of stopping the page.
  function defaultStorage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; }
    catch (e) { return null; }
  }

  // An object is an envelope if it carries envelope fields (ns, savedAt, or
  // a v+state pair). A damaged envelope must not be treated as legacy raw state.
  function looksLikeEnvelope(parsed) {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    if (Object.prototype.hasOwnProperty.call(parsed, 'ns')) return true;
    if (Object.prototype.hasOwnProperty.call(parsed, 'savedAt')) return true;
    if (Object.prototype.hasOwnProperty.call(parsed, 'state') && Object.prototype.hasOwnProperty.call(parsed, 'v')) return true;
    return false;
  }

  // Shared per-game persistence: versioned envelope in localStorage plus
  // portable base64 save codes (the MarsScape relocation format).
  function createSaveStore(namespace, opts) {
    opts = opts || {};
    var version = opts.version || 1;
    var storage = opts.storage || defaultStorage();
    var migrate = opts.migrate || null;

    function unwrapResult(parsed) {
      if (parsed === null || parsed === undefined) return { status: 'empty', state: null };
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { status: 'corrupt', state: null, error: 'not an object' };
      }
      if (!looksLikeEnvelope(parsed)) {
        return { status: 'ok', state: parsed, version: null, legacy: true };
      }
      if (parsed.ns !== namespace) {
        return { status: 'corrupt', state: null, error: 'wrong namespace' };
      }
      if (typeof parsed.v === 'number' && parsed.v > version) {
        return { status: 'newer', state: null, version: parsed.v, held: parsed.state };
      }
      var state = parsed.state;
      if (state === undefined) {
        return { status: 'corrupt', state: null, error: 'missing state' };
      }
      if (migrate && typeof parsed.v === 'number' && parsed.v < version) {
        try {
          state = migrate(state, parsed.v);
        } catch (e) {
          return { status: 'corrupt', state: null, version: parsed.v, error: e };
        }
      }
      if (state === undefined) {
        return { status: 'corrupt', state: null, error: 'empty state' };
      }
      return { status: 'ok', state: state, version: typeof parsed.v === 'number' ? parsed.v : version };
    }

    function readResult() {
      if (!storage) return { status: 'empty', state: null };
      var raw;
      try { raw = storage.getItem(namespace); }
      catch (e) { return { status: 'corrupt', state: null, error: e }; }
      if (raw === null || raw === undefined || raw === '') return { status: 'empty', state: null };
      try { return unwrapResult(JSON.parse(raw)); }
      catch (e) { return { status: 'corrupt', state: null, error: e }; }
    }

    function stateOrThrow(result) {
      if (result.status === 'ok') return result.state;
      if (result.status === 'empty') return null;
      var err = MixKitSaveError(
        result.status,
        result.status === 'newer' ? 'Save is from a newer version' : 'Save is corrupt'
      );
      err.result = result;
      throw err;
    }

    return {
      key: namespace,
      loadResult: function () { return readResult(); },
      load: function () { return stateOrThrow(readResult()); },
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
      importCodeResult: function (code) {
        var result;
        try { result = unwrapResult(JSON.parse(decodeCode(String(code || '').trim()))); }
        catch (e) { return { status: 'corrupt', state: null, error: e }; }
        if (result.status === 'ok') this.save(result.state);
        return result;
      },
      importCode: function (code) {
        var result = this.importCodeResult(code);
        return result.status === 'ok' ? result.state : null;
      }
    };
  }

  var api = {
    createSaveStore: createSaveStore,
    encodeCode: encodeCode,
    decodeCode: decodeCode,
    MixKitSaveError: MixKitSaveError,
  };
  if (global) global.MixKitSave = api;
})(typeof window !== 'undefined' ? window : globalThis);
