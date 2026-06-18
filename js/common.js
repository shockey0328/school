/**
 * 广州大学附属中学教育集团学情数据看板 — 全局公共函数
 * 依赖：Papa Parse（全局 Papa）
 */
(function (global) {
  'use strict';

  var DATA_PERIOD_START = '2025-09-01';
  var DATA_PERIOD_END = '2025-09-30';

  /** 内置兜底（data/单位维护表.csv 加载失败时使用） */
  var DEFAULT_SCHOOL_BRANDS = [
    {
      dataSchool: '广州大学附属中学',
      aliases: ['广州大学附属中学', '广大附中'],
      displayName: '广州大学附属中学',
      logoFile: '广州大学附属中学logo.png',
      dataSourceSchool: '',
    },
    {
      dataSchool: '广附番禺实验学校',
      aliases: ['广附番禺实验学校', '广大附中番禺实验学校'],
      displayName: '广大附中番禺实验学校',
      logoFile: '',
      dataSourceSchool: '',
    },
    {
      dataSchool: '黔程智教',
      aliases: ['黔程智教'],
      displayName: '黔程智教',
      logoFile: '黔程智教logo.png',
      dataSourceSchool: '广州大学附属中学',
    },
  ];

  var _schoolBrandsCache = null;
  var _schoolBrandsPromise = null;

  var TENANT_TEXT_FIELDS = [
    'paper_name',
    '试卷名称',
    '练习名称',
    'material_name',
    '资源名称',
    'video_name',
    'video_title',
    'knowledge_point',
    '知识点',
  ];

  var LOGO_DIR = 'logo/';
  var SCHOOL_LOGO_CACHE_BUST = '20260612';

  var MANAGEMENT_ROLES = ['校长', '年级组长', '学科组长'];
  var FRONTLINE_ROLES = ['老师', '教师'];

  /* ==================== 一、全局状态 AppState ==================== */
  var AppState = {
    setUser: function (user) {
      try {
        if (user == null) {
          localStorage.removeItem('currentUser');
          return;
        }
        var brand = getSchoolBrand(user.school_name || '');
        var normalized = Object.assign({}, user, {
          school_name: brand.dataSchool,
        });
        if (!normalized.teach_classes && normalized['授课班级']) {
          normalized.teach_classes = String(normalized['授课班级']).trim();
        }
        if (!normalized.manage_class && normalized['管理班级']) {
          normalized.manage_class = String(normalized['管理班级']).trim();
        }
        if (!normalized.class_name && normalized.manage_class) {
          normalized.class_name = normalized.manage_class;
        }
        localStorage.setItem('currentUser', JSON.stringify(normalized));
        localStorage.setItem('currentSchool', brand.dataSchool);
      } catch (e) {
        console.error('AppState.setUser failed', e);
      }
    },

    setSchool: function (school) {
      try {
        var v = getSchoolBrand(school == null ? '' : school).dataSchool;
        localStorage.setItem('currentSchool', v);
      } catch (e) {
        console.error('AppState.setSchool failed', e);
      }
    },

    getUser: function () {
      try {
        var str = localStorage.getItem('currentUser');
        if (!str) return null;
        return JSON.parse(str);
      } catch (e) {
        return null;
      }
    },

    getSchool: function () {
      try {
        return localStorage.getItem('currentSchool') || '';
      } catch (e) {
        return '';
      }
    },

    getRole: function () {
      var user = this.getUser();
      return user && user.role ? String(user.role) : '';
    },

    getGrade: function () {
      var user = this.getUser();
      return user && user.grade ? String(user.grade).trim() : '';
    },

    getManageClass: function () {
      var user = this.getUser();
      if (!user) return '';
      return String(user.manage_class || user.class_name || '').trim();
    },

    getTeachClasses: function () {
      var user = this.getUser();
      if (!user) return [];
      var raw = user.teach_classes || user['授课班级'] || '';
      if (!raw) return [];
      return String(raw)
        .split(/[,，]/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
    },

    getSubject: function () {
      var user = this.getUser();
      return user && user.subject ? String(user.subject).trim() : '';
    },

    getUserLevel: function () {
      var user = this.getUser();
      return user && user.user_level ? String(user.user_level).trim() : '';
    },

    isManagement: function () {
      var user = this.getUser();
      if (!user) return false;
      if (user.user_level === '管理层') return true;
      return MANAGEMENT_ROLES.indexOf(user.role) !== -1;
    },

    isFrontline: function () {
      var user = this.getUser();
      if (!user) return false;
      if (user.user_level === '一线层') return true;
      return FRONTLINE_ROLES.indexOf(user.role) !== -1;
    },

    /** @deprecated 使用 isManagement */
    isSchoolAdmin: function () {
      return this.isManagement();
    },

    /** @deprecated 使用 isFrontline */
    isTeacher: function () {
      return this.isFrontline();
    },

    /** @deprecated 使用 getGrade */
    getTeacherGrade: function () {
      return this.getGrade();
    },

    /** @deprecated 使用 getManageClass */
    getTeacherClass: function () {
      return this.getManageClass();
    },

    getTeacherCampus: function () {
      var user = this.getUser();
      return user && user.campus ? String(user.campus).trim() : '';
    },

    isManageClass: function (className) {
      var mc = this.getManageClass();
      if (!mc || !className) return false;
      return mc === String(className).trim();
    },

    canViewSubjectInClass: function (className, subject) {
      if (this.isManagement()) return true;
      if (this.isManageClass(className)) return true;
      var mySubject = this.getSubject();
      if (!mySubject) return true;
      if (!subject) return true;
      return subject === mySubject;
    },

    getAllVisibleClasses: function () {
      var user = this.getUser();
      if (!user) return [];
      if (this.isManagement()) return [];
      var classes = new Set();
      if (user.manage_class) classes.add(String(user.manage_class).trim());
      if (user.class_name && !user.manage_class) classes.add(String(user.class_name).trim());
      this.getTeachClasses().forEach(function (c) {
        classes.add(c);
      });
      return Array.from(classes);
    },

    setCutoffDate: function (date) {
      var end = date ? String(date).slice(0, 10) : DATA_PERIOD_END;
      this.setDateRange(DATA_PERIOD_START, end);
    },

    setDateRange: function (start, end) {
      try {
        var s = String(start || DATA_PERIOD_START).slice(0, 10);
        var e = String(end || DATA_PERIOD_END).slice(0, 10);
        if (s > e) {
          var t = s;
          s = e;
          e = t;
        }
        s = clampDateToPeriod(s, 'start');
        e = clampDateToPeriod(e, 'end');
        localStorage.setItem('dateRangeStart', s);
        localStorage.setItem('dateRangeEnd', e);
        localStorage.removeItem('cutoffDate');
      } catch (err) {
        console.error('AppState.setDateRange failed', err);
      }
    },

    getDateRange: function () {
      try {
        var s = localStorage.getItem('dateRangeStart');
        var e = localStorage.getItem('dateRangeEnd');
        if (s && e) {
          return {
            start: clampDateToPeriod(s.slice(0, 10), 'start'),
            end: clampDateToPeriod(e.slice(0, 10), 'end'),
          };
        }
        var legacy = localStorage.getItem('cutoffDate');
        if (legacy) {
          return {
            start: DATA_PERIOD_START,
            end: clampDateToPeriod(legacy.slice(0, 10), 'end'),
          };
        }
      } catch (err) {
        /* ignore */
      }
      return { start: DATA_PERIOD_START, end: DATA_PERIOD_END };
    },

    getCutoffDate: function () {
      return this.getDateRange().end;
    },

    logout: function () {
      try {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentSchool');
        localStorage.removeItem('cutoffDate');
        localStorage.removeItem('dateRangeStart');
        localStorage.removeItem('dateRangeEnd');
        resetSchoolBrandsCache();
      } catch (e) {
        console.error('AppState.logout failed', e);
      }
      global.location.href = 'index.html';
    },

    getDefaultLandingHref: function () {
      if (!this.getUser() || !this.getSchool()) return 'index.html';
      if (this.isManagement()) return 'cockpit.html';
      return 'diagnosis.html';
    },

    getSchoolBrand: function () {
      return getSchoolBrand(this.getSchool());
    },

    getSchoolDisplayName: function () {
      var brand = getSchoolBrand(this.getSchool());
      return brand.displayName || this.getSchool() || '';
    },
  };

  var CLASS_BOARD_PAGE = 'diagnosis.html';

  /* ==================== 学校品牌（由 CSV 动态加载） ==================== */
  /** Logo 统一存放在站点根目录 logo/ 下；CSV 中可只填文件名 */
  function normalizeLogoFile(filename) {
    var raw = String(filename || '').split('?')[0].trim();
    if (!raw) return '';
    var normalized = raw.replace(/\\/g, '/');
    if (/^(?:[a-z]+:)?\/\//i.test(normalized)) return normalized;
    if (normalized.charAt(0) === '/') return normalized.slice(1);
    if (normalized.indexOf(LOGO_DIR) === 0) return normalized;
    if (normalized.indexOf('logo/') === 0) return normalized;
    return LOGO_DIR + normalized;
  }

  function cloneSchoolBrands(list) {
    return (list || []).map(function (b) {
      return {
        dataSchool: b.dataSchool,
        displayName: b.displayName,
        logoFile: normalizeLogoFile(b.logoFile || ''),
        dataSourceSchool: b.dataSourceSchool || '',
        aliases: Array.isArray(b.aliases) ? b.aliases.slice() : [],
        textReplace: Array.isArray(b.textReplace) ? b.textReplace.slice() : [],
      };
    });
  }

  function getSchoolBrandsCache() {
    if (!_schoolBrandsCache) _schoolBrandsCache = cloneSchoolBrands(DEFAULT_SCHOOL_BRANDS);
    return _schoolBrandsCache;
  }

  function findSchoolBrandIndex(dataSchool) {
    var key = String(dataSchool || '').trim();
    if (!key) return -1;
    var brands = getSchoolBrandsCache();
    for (var i = 0; i < brands.length; i++) {
      if (brands[i].dataSchool === key) return i;
    }
    return -1;
  }

  function normalizeSchoolBrandEntry(entry) {
    var dataSchool = String(entry.dataSchool || '').trim();
    if (!dataSchool) return null;
    var aliases = Array.isArray(entry.aliases)
      ? entry.aliases.map(function (s) {
          return String(s || '').trim();
        }).filter(Boolean)
      : [];
    if (aliases.indexOf(dataSchool) === -1) aliases.unshift(dataSchool);
    return {
      dataSchool: dataSchool,
      displayName: String(entry.displayName || dataSchool).trim(),
      logoFile: normalizeLogoFile(entry.logoFile || ''),
      dataSourceSchool: String(entry.dataSourceSchool || '').trim(),
      aliases: aliases,
      textReplace: Array.isArray(entry.textReplace) ? entry.textReplace.slice() : [],
    };
  }

  function registerSchoolBrand(entry, replace) {
    var brand = normalizeSchoolBrandEntry(entry);
    if (!brand) return;
    var brands = getSchoolBrandsCache();
    var idx = findSchoolBrandIndex(brand.dataSchool);
    if (idx >= 0) {
      if (replace) {
        brands[idx] = brand;
        return;
      }
      var existing = brands[idx];
      brand.aliases.forEach(function (alias) {
        if (existing.aliases.indexOf(alias) === -1) existing.aliases.push(alias);
      });
      if (brand.displayName) existing.displayName = brand.displayName;
      if (brand.logoFile) existing.logoFile = brand.logoFile;
      if (brand.dataSourceSchool) existing.dataSourceSchool = brand.dataSourceSchool;
      return;
    }
    brands.push(brand);
  }

  function parseOrganizationCsvRow(row) {
    if (!row) return null;
    var dataSchool = String(row['单位标识'] || row['学校名称'] || row.dataSchool || '')
      .replace(/\uFEFF/g, '')
      .trim();
    if (!dataSchool) return null;
    var aliasesRaw = String(row['别名'] || row.aliases || '').trim();
    var aliases = aliasesRaw
      ? aliasesRaw.split(/[,，;；]/).map(function (s) {
          return s.trim();
        }).filter(Boolean)
      : [];
    return {
      dataSchool: dataSchool,
      displayName: String(row['展示名称'] || row.displayName || dataSchool).trim(),
      logoFile: String(row['Logo文件名'] || row['Logo文件'] || row.logoFile || '').trim(),
      dataSourceSchool: String(row['数据源学校'] || row.dataSourceSchool || '').trim(),
      aliases: aliases,
    };
  }

  function parseAccountBrandHints(row) {
    if (!row) return null;
    var dataSchool = String(row['学校名称'] || '').replace(/\uFEFF/g, '').trim();
    if (!dataSchool) return null;
    var displayName = String(row['展示名称'] || '').trim();
    var logoFile = String(row['Logo文件名'] || row['Logo文件'] || '').trim();
    var dataSourceSchool = String(row['数据源学校'] || '').trim();
    if (!displayName && !logoFile && !dataSourceSchool) return null;
    return {
      dataSchool: dataSchool,
      displayName: displayName || dataSchool,
      logoFile: logoFile,
      dataSourceSchool: dataSourceSchool,
      aliases: [dataSchool],
    };
  }

  function inferSchoolBrandFromName(schoolName) {
    var name = String(schoolName || '').trim();
    if (!name) return null;
    return {
      dataSchool: name,
      displayName: name,
      logoFile: name + 'logo.png',
      dataSourceSchool: '',
      aliases: [name],
    };
  }

  function mergeSchoolBrandsFromData(orgRows, accounts) {
    _schoolBrandsCache = cloneSchoolBrands(DEFAULT_SCHOOL_BRANDS);

    (orgRows || []).forEach(function (row) {
      var brand = parseOrganizationCsvRow(row);
      if (brand) registerSchoolBrand(brand, true);
    });

    (accounts || []).forEach(function (row) {
      var hint = parseAccountBrandHints(row);
      if (hint) registerSchoolBrand(hint, false);
    });

    var seen = {};
    (accounts || []).forEach(function (row) {
      var school = String(row['学校名称'] || '').replace(/\uFEFF/g, '').trim();
      if (!school || seen[school]) return;
      seen[school] = true;
      if (findSchoolBrandIndex(school) < 0) {
        var inferred = inferSchoolBrandFromName(school);
        if (inferred) registerSchoolBrand(inferred, false);
      }
    });

    return getSchoolBrandsCache();
  }

  function resetSchoolBrandsCache() {
    _schoolBrandsCache = null;
    _schoolBrandsPromise = null;
  }

  function ensureSchoolBrands() {
    if (_schoolBrandsPromise) return _schoolBrandsPromise;
    _schoolBrandsPromise = Promise.all([DataLoader.organizations(), DataLoader.accounts()])
      .then(function (results) {
        return mergeSchoolBrandsFromData(results[0], results[1]);
      })
      .catch(function (e) {
        console.warn('ensureSchoolBrands failed, using defaults', e);
        _schoolBrandsCache = cloneSchoolBrands(DEFAULT_SCHOOL_BRANDS);
        return _schoolBrandsCache;
      });
    return _schoolBrandsPromise;
  }

  function getSchoolBrand(rawSchool) {
    var raw = String(rawSchool || '').trim();
    var brands = getSchoolBrandsCache();
    for (var i = 0; i < brands.length; i++) {
      var b = brands[i];
      if (raw === b.dataSchool || b.aliases.indexOf(raw) !== -1) {
        return {
          dataSchool: b.dataSchool,
          displayName: b.displayName,
          logoFile: b.logoFile || '',
          dataSourceSchool: b.dataSourceSchool || '',
          textReplace: Array.isArray(b.textReplace) ? b.textReplace.slice() : [],
        };
      }
    }
    return {
      dataSchool: raw,
      displayName: raw,
      logoFile: raw ? normalizeLogoFile(raw + 'logo.png') : '',
      dataSourceSchool: '',
      textReplace: [],
    };
  }

  function getDataSchoolKey(school) {
    var brand = getSchoolBrand(school);
    return brand.dataSourceSchool || brand.dataSchool;
  }

  function isTenantDataMapped(brand) {
    if (!brand) return false;
    var source = brand.dataSourceSchool;
    return Boolean(source && source !== brand.dataSchool);
  }

  function buildTenantTextReplacements(brand) {
    if (!brand || !isTenantDataMapped(brand)) return [];
    var sourceBrand = getSchoolBrand(brand.dataSourceSchool);
    var reps = [];
    var seen = {};

    function pushRep(from, to) {
      var f = String(from || '').trim();
      var t = String(to || '').trim();
      if (!f || !t || f === t || seen[f]) return;
      seen[f] = true;
      reps.push({ from: f, to: t });
    }

    pushRep(sourceBrand.dataSchool, brand.displayName);
    (sourceBrand.aliases || []).forEach(function (alias) {
      pushRep(alias, brand.displayName);
    });
    (brand.textReplace || []).forEach(function (item) {
      pushRep(item.from, item.to);
    });
    reps.sort(function (a, b) {
      return b.from.length - a.from.length;
    });
    return reps;
  }

  function formatTenantText(text, school) {
    var raw = text == null ? '' : String(text);
    if (!raw) return raw;
    var brand = getSchoolBrand(
      school != null && String(school).trim() !== '' ? school : AppState.getSchool()
    );
    var reps = buildTenantTextReplacements(brand);
    if (!reps.length) return raw;
    var result = raw;
    reps.forEach(function (rep) {
      result = result.split(rep.from).join(rep.to);
    });
    return result;
  }

  function mapRowForTenant(row, brand) {
    if (!row || !brand || !isTenantDataMapped(brand)) return row;
    var out = Object.assign({}, row);
    if (out.school_name != null) out.school_name = brand.dataSchool;
    if (out['学校'] != null) out['学校'] = brand.dataSchool;
    TENANT_TEXT_FIELDS.forEach(function (field) {
      if (out[field] != null && out[field] !== '') {
        out[field] = formatTenantText(out[field], brand.dataSchool);
      }
    });
    return out;
  }

  function applyTenantToRows(rows, school) {
    if (!Array.isArray(rows)) return [];
    var brand = getSchoolBrand(school != null ? school : AppState.getSchool());
    if (!isTenantDataMapped(brand)) return rows.slice();
    return rows.map(function (row) {
      return mapRowForTenant(row, brand);
    });
  }

  function applyPageBranding() {
    if (typeof document === 'undefined') return;
    var pageTitle = document.body ? document.body.getAttribute('data-page-title') || '' : '';
    var orgName = AppState.getSchoolDisplayName() || '学情数据看板';
    document.title = (pageTitle ? pageTitle + ' - ' : '') + orgName + '学情数据看板';
  }

  function applyLoginPageBranding() {
    if (typeof document === 'undefined') return;
    document.title = '登录 — 学情数据看板';
    var logoEl = document.querySelector('.login-logo');
    if (logoEl) logoEl.textContent = '学情数据看板';
  }

  function resolveAssetHref(filename, cacheBust) {
    if (!filename) return '';
    var baseName = String(filename).split('?')[0].trim();
    if (!baseName) return '';
    var href = '';
    try {
      var baseRef =
        typeof document !== 'undefined' && document.baseURI
          ? document.baseURI
          : global.location && global.location.href
            ? global.location.href
            : '';
      if (baseRef) href = new URL(baseName, baseRef).href;
    } catch (e) {
      /* ignore */
    }
    if (!href) href = baseName;
    if (cacheBust != null && String(cacheBust).trim() !== '') {
      href += (href.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(String(cacheBust).trim());
    }
    return href;
  }

  /* ==================== 二、CSV 加载 ==================== */
  function decodeCsvBytes(buffer) {
    var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (!bytes.length) return '';

    var offset = 0;
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      offset = 3;
    }

    var slice = bytes.subarray(offset);
    var utf8Text = '';
    try {
      utf8Text = new TextDecoder('utf-8', { fatal: true }).decode(slice);
    } catch (utf8Err) {
      try {
        return new TextDecoder('gb18030').decode(slice);
      } catch (gbErr) {
        return new TextDecoder('utf-8').decode(slice);
      }
    }
    var badRepl = (utf8Text.match(/\uFFFD/g) || []).length;
    if (badRepl >= 3) {
      try {
        var gbText = new TextDecoder('gb18030').decode(slice);
        if ((gbText.match(/\uFFFD/g) || []).length < badRepl) return gbText;
      } catch (gbErr2) {
        /* keep utf-8 */
      }
    }
    return utf8Text;
  }

  /** 后台账号表列顺序（表头乱码时按列序回退读取） */
  var ACCOUNT_CSV_COL_INDEX = {
    用户身份: 0,
    用户分层: 1,
    用户名: 2,
    登录密码: 3,
    学校名称: 4,
    展示名称: 5,
    Logo文件名: 6,
    数据源学校: 7,
    所属校区: 8,
    年级: 9,
    管理班级: 10,
    授课班级: 11,
    学科: 12,
  };

  function readAccountField(row, fieldName) {
    if (!row || !fieldName) return '';
    var direct = row[fieldName];
    if (direct != null && String(direct).trim() !== '') {
      return String(direct).replace(/\uFEFF/g, '').trim();
    }
    var idx = ACCOUNT_CSV_COL_INDEX[fieldName];
    if (idx == null) return '';
    var keys = Object.keys(row);
    if (keys.length <= idx) return '';
    var fallback = row[keys[idx]];
    if (fallback == null) return '';
    return String(fallback).replace(/\uFEFF/g, '').trim();
  }

  function loadCSV(filename) {
    if (typeof global.Papa === 'undefined' || typeof global.Papa.parse !== 'function') {
      console.error('loadCSV: Papa Parse 未加载');
      return Promise.resolve([]);
    }

    var url;
    try {
      var baseRef =
        typeof document !== 'undefined' && document.baseURI
          ? document.baseURI
          : global.location.href;
      url = new URL(filename, new URL('data/', baseRef)).href;
    } catch (e2) {
      url = 'data/' + filename;
    }

    if (global.location && global.location.protocol === 'file:') {
      console.warn('loadCSV: 请通过本地 HTTP 服务访问，勿使用 file://');
    }

    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then(function (buffer) {
        var text = decodeCsvBytes(buffer);
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        var isAccountsFile = /账号/.test(filename);
        var parseOpts = {
          header: true,
          skipEmptyLines: true,
          transformHeader: function (h) {
            return String(h || '')
              .replace(/^\uFEFF/, '')
              .trim();
          },
        };
        var isDailyActiveFile = /daily_active/.test(filename);
        if (isAccountsFile || isDailyActiveFile) {
          parseOpts.dynamicTyping = false;
          parseOpts.transform = function (value) {
            if (value === null || value === undefined) return '';
            return String(value);
          };
        } else {
          parseOpts.dynamicTyping = true;
        }
        var parsed = global.Papa.parse(text, parseOpts);
        if (parsed.errors && parsed.errors.length) {
          parsed.errors.forEach(function (err) {
            console.warn('Papa.parse warning:', err);
          });
        }
        return Array.isArray(parsed.data) ? parsed.data : [];
      })
      .catch(function (e) {
        console.error('loadCSV failed:', filename, e);
        return [];
      });
  }

  var DataLoader = {
    accounts: function () {
      return loadCSV('accounts.csv').then(function (rows) {
        if (rows && rows.length > 0) return rows;
        return loadCSV('后台管理账号维护表.csv');
      });
    },
    organizations: function () {
      return loadCSV('单位维护表.csv');
    },
    ensureSchoolBrands: ensureSchoolBrands,
    students: function () {
      return loadCSV('students.csv');
    },
    dailyActive: function () {
      return loadCSV('daily_active.csv');
    },
    usageSummary: function () {
      return loadCSV('usage_summary.csv');
    },
    materialDetail: function () {
      return loadCSV('material_detail.csv');
    },
    videoDetail: function () {
      return loadCSV('video_detail.csv');
    },
    examDetail: function () {
      return loadCSV('exam_detail.csv');
    },
    practiceDetail: function () {
      return loadCSV('practice_detail.csv');
    },
    knowledgeMastery: function () {
      return loadCSV('knowledge_mastery.csv');
    },
    paperQuestions: function () {
      return loadCSV('paper_questions.csv');
    },
  };

  /* ==================== 行字段读取（中英文字段兼容） ==================== */
  function rowStudentId(row) {
    if (!row) return '';
    return String(
      row.user_id != null && row.user_id !== ''
        ? row.user_id
        : row.student_id != null
          ? row.student_id
          : row['用户ID'] != null
            ? row['用户ID']
            : row['学生编号'] || ''
    ).trim();
  }

  function rowStudentName(row) {
    if (!row) return '';
    return String(row.student_name != null ? row.student_name : row['姓名'] || '').trim();
  }

  function rowSchoolName(row) {
    if (!row) return '';
    return String(row.school_name != null ? row.school_name : row['学校'] || '').trim();
  }

  function rowGradeVal(row) {
    if (!row) return '';
    return String(
      row.grade_name != null && row.grade_name !== ''
        ? row.grade_name
        : row.grade_level != null
          ? row.grade_level
          : row.grade != null
            ? row.grade
            : row['年级'] || ''
    ).trim();
  }

  function rowClassName(row) {
    if (!row) return '';
    return String(
      row.class_name != null ? row.class_name : row['班级'] != null ? row['班级'] : ''
    ).trim();
  }

  function rowSubject(row) {
    if (!row) return '';
    return String(
      row.subject_name != null && row.subject_name !== ''
        ? row.subject_name
        : row.subject != null
          ? row.subject
          : row['学科'] || ''
    ).trim();
  }

  function rowMaterialTitle(row) {
    if (!row) return '';
    return String(
      row.res_title != null && row.res_title !== ''
        ? row.res_title
        : row.material_name != null
          ? row.material_name
          : row.video_name != null
            ? row.video_name
            : row['资料名称'] || row['视频名称'] || row.name || ''
    ).trim();
  }

  /** 章节目录路径，如「第一单元>小数乘法」 */
  function rowCatalogNames(row) {
    if (!row) return '';
    var val =
      row.catalog_names != null && row.catalog_names !== ''
        ? row.catalog_names
        : row['目录'] || row.chapter || row['章节'] || '';
    if (isNullishCsvValue(val)) return '';
    return String(val).trim();
  }

  function rowContentType(row) {
    if (!row) return '';
    var val =
      row.content_type != null && row.content_type !== ''
        ? row.content_type
        : row['内容类型'] || '';
    if (isNullishCsvValue(val)) return '';
    return String(val).trim();
  }

  function isNullishCsvValue(val) {
    if (val == null || val === '') return true;
    var s = String(val).trim();
    return s === '\\N' || s === 'NULL' || s === 'null';
  }

  function rowTimeValue(row, timeField) {
    if (!row) return '';
    if (timeField) {
      var direct = row[timeField];
      if (direct != null && direct !== '' && !isNullishCsvValue(direct)) {
        return String(direct).trim();
      }
    }
    return String(
      row.time != null && row.time !== ''
        ? row.time
        : row.dt != null && row.dt !== ''
          ? row.dt
          : row.submit_time != null
            ? row.submit_time
            : row.judge_time != null
              ? row.judge_time
              : row['提交时间'] || row['查看日期'] || row['观看日期'] || row['日期'] || ''
    ).trim();
  }

  function uniqueFieldValues(data, enField, cnField) {
    if (!Array.isArray(data)) return [];
    var set = new Set();
    data.forEach(function (item) {
      if (!item) return;
      var v = item[enField];
      if (v == null || v === '') v = cnField ? item[cnField] : undefined;
      if (v != null && String(v).trim() !== '') set.add(String(v).trim());
    });
    return Array.from(set);
  }

  var GRADE_SORT_ORDER = [
    '初一',
    '初二',
    '初三',
    '高一',
    '高二',
    '高三',
    '七年级',
    '八年级',
    '九年级',
  ];

  var SUBJECT_SORT_ORDER = [
    '语文',
    '数学',
    '英语',
    '物理',
    '化学',
    '生物',
    '道德与法治',
    '思想政治',
    '历史',
    '地理',
    '科学',
  ];

  function gradeSortIndex(grade) {
    var g = String(grade || '').trim();
    var idx = GRADE_SORT_ORDER.indexOf(g);
    if (idx >= 0) return idx;
    var m = g.match(/^(初|高)([一二三1-3])/);
    if (m) {
      var level = m[1] === '初' ? 0 : 3;
      var numMap = { 一: 0, 二: 1, 三: 2, '1': 0, '2': 1, '3': 2 };
      return level + (numMap[m[2]] != null ? numMap[m[2]] : 0);
    }
    return 999;
  }

  function compareGradeAsc(a, b) {
    var ia = gradeSortIndex(a);
    var ib = gradeSortIndex(b);
    if (ia !== ib) return ia - ib;
    return String(a).localeCompare(String(b), 'zh-CN');
  }

  function subjectSortIndex(subject) {
    var idx = SUBJECT_SORT_ORDER.indexOf(String(subject || '').trim());
    return idx >= 0 ? idx : 999;
  }

  function compareSubjectAsc(a, b) {
    var ia = subjectSortIndex(a);
    var ib = subjectSortIndex(b);
    if (ia !== ib) return ia - ib;
    return String(a).localeCompare(String(b), 'zh-CN');
  }

  function sortGradesAsc(list) {
    return (list || []).slice().sort(compareGradeAsc);
  }

  function sortSubjectsAsc(list) {
    return (list || []).slice().sort(compareSubjectAsc);
  }

  /* ==================== 三、数据筛选 ==================== */
  function filterBySchool(data, school) {
    if (!Array.isArray(data)) return [];
    var s = school == null ? '' : String(school).trim();
    if (!s) return data.slice();
    var brand = getSchoolBrand(s);
    var sourceKey = getDataSchoolKey(s);
    var tenantKey = brand.dataSchool;
    var mapped = isTenantDataMapped(brand);
    var filtered = data.filter(function (row) {
      if (!row) return false;
      var name = rowSchoolName(row);
      if (name === sourceKey) return true;
      return mapped && name === tenantKey;
    });
    if (!mapped) return filtered;
    return filtered.map(function (row) {
      if (rowSchoolName(row) === tenantKey) return row;
      return mapRowForTenant(row, brand);
    });
  }

  function filterByGrade(data, grade) {
    if (!Array.isArray(data)) return [];
    var g = grade == null ? '' : String(grade).trim();
    if (!g || g === '全部') return data.slice();
    return data.filter(function (row) {
      return row && rowGradeVal(row) === g;
    });
  }

  function filterByClass(data, className) {
    if (!Array.isArray(data)) return [];
    var c = className == null ? '' : String(className).trim();
    if (!c || c === '全部') return data.slice();
    return data.filter(function (row) {
      return row && rowClassName(row) === c;
    });
  }

  function filterBySubject(data, subject) {
    if (!Array.isArray(data)) return [];
    var s = subject == null ? '' : String(subject).trim();
    if (!s || s === '全部') return data.slice();
    return data.filter(function (row) {
      return row && rowSubject(row) === s;
    });
  }

  function filterByStudentId(data, studentId) {
    if (!Array.isArray(data)) return [];
    var id = studentId == null ? '' : String(studentId).trim();
    if (!id) return [];
    return data.filter(function (row) {
      return row && rowStudentId(row) === id;
    });
  }

  function filterByStudentIds(data, studentIds) {
    if (!Array.isArray(data)) return [];
    if (!Array.isArray(studentIds) || studentIds.length === 0) return [];
    var set = new Set(
      studentIds.map(function (id) {
        return String(id == null ? '' : id).trim();
      }).filter(Boolean)
    );
    if (set.size === 0) return [];
    return data.filter(function (row) {
      return row && set.has(rowStudentId(row));
    });
  }

  function parseItemDate(timeValue) {
    if (!timeValue) return null;
    var s = String(timeValue).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(s + 'T23:59:59');
    }
    var d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function clampDateToPeriod(dateStr, edge) {
    var d = normalizeDateKey(dateStr);
    if (!d) return edge === 'start' ? DATA_PERIOD_START : DATA_PERIOD_END;
    if (d < DATA_PERIOD_START) return DATA_PERIOD_START;
    if (d > DATA_PERIOD_END) return DATA_PERIOD_END;
    return d;
  }

  function filterByDateRange(data, startDate, endDate, timeField) {
    if (!Array.isArray(data)) return [];
    var start = startDate ? String(startDate).slice(0, 10) : '';
    var end = endDate ? String(endDate).slice(0, 10) : '';
    if (!start && !end) return data.slice();
    var startTs = start ? new Date(start + 'T00:00:00').getTime() : null;
    var endTs = end ? new Date(end + 'T23:59:59').getTime() : null;
    return data.filter(function (item) {
      if (!item) return false;
      var timeValue = rowTimeValue(item, timeField);
      if (!timeValue) return true;
      var itemDate = parseItemDate(timeValue);
      if (!itemDate) return true;
      var t = itemDate.getTime();
      if (startTs != null && t < startTs) return false;
      if (endTs != null && t > endTs) return false;
      return true;
    });
  }

  function filterByCutoffDate(data, cutoffDate, timeField) {
    return filterByDateRange(data, DATA_PERIOD_START, cutoffDate, timeField);
  }

  /** 统一为 YYYY-MM-DD，兼容 2025/9/1、2025-09-01 等格式 */
  function normalizeDateKey(dateStr) {
    if (dateStr == null || dateStr === '') return '';
    var text = String(dateStr).trim();
    if (!text) return '';

    var iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      return (
        iso[1] +
        '-' +
        String(iso[2]).padStart(2, '0') +
        '-' +
        String(iso[3]).padStart(2, '0')
      );
    }

    var slash = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (slash) {
      return (
        slash[1] +
        '-' +
        String(slash[2]).padStart(2, '0') +
        '-' +
        String(slash[3]).padStart(2, '0')
      );
    }

    var d = new Date(text);
    if (!Number.isNaN(d.getTime())) {
      return (
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0')
      );
    }

    return text.slice(0, 10);
  }

  /* ==================== 日活跃（长表：user_id + dt + is_active） ==================== */

  function isDailyActiveFlag(val) {
    return val === 1 || val === '1' || val === true;
  }

  function rowDailyActiveUserId(row) {
    if (!row) return '';
    return String(
      row.user_id != null && row.user_id !== ''
        ? row.user_id
        : row['用户ID'] != null && row['用户ID'] !== ''
          ? row['用户ID']
          : rowStudentId(row)
    ).trim();
  }

  function rowDailyActiveDate(row) {
    if (!row) return '';
    var dt = row.dt != null && row.dt !== '' ? row.dt : row['日期'] || row.date || '';
    return normalizeDateKey(dt);
  }

  function rowDailyActiveIsActive(row) {
    if (!row) return false;
    var val = row.is_active != null ? row.is_active : row['是否活跃'];
    return isDailyActiveFlag(val);
  }

  function rowDailyActiveLearningDurationMin(row) {
    if (!row) return 0;
    var val =
      row.learning_duration_min != null && row.learning_duration_min !== ''
        ? row.learning_duration_min
        : row['学习时长_分钟'] != null && row['学习时长_分钟'] !== ''
          ? row['学习时长_分钟']
          : row['学习时长'];
    var n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function isDailyActiveWideRow(row) {
    if (!row || typeof row !== 'object') return false;
    if (row.dt != null || row['日期'] != null) return false;
    return Object.keys(row).some(function (k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(k);
    });
  }

  /** 宽表 → 长表；已是长表则归一化字段名 */
  function normalizeDailyActiveRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return [];
    if (!isDailyActiveWideRow(rows[0])) {
      return rows
        .map(function (row) {
          var uid = rowDailyActiveUserId(row);
          var dt = rowDailyActiveDate(row);
          if (!uid || !dt) return null;
          return {
            user_id: uid,
            dt: dt,
            is_active: rowDailyActiveIsActive(row) ? 1 : 0,
            learning_duration_min: rowDailyActiveLearningDurationMin(row),
          };
        })
        .filter(Boolean);
    }
    var out = [];
    rows.forEach(function (row) {
      var uid = rowStudentId(row);
      if (!uid) return;
      Object.keys(row).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
        out.push({
          user_id: uid,
          dt: k,
          is_active: isDailyActiveFlag(row[k]) ? 1 : 0,
        });
      });
    });
    return out;
  }

  function filterDailyActiveRecords(records, opts) {
    opts = opts || {};
    var start = opts.startDate ? normalizeDateKey(opts.startDate) : '';
    var end = opts.endDate ? normalizeDateKey(opts.endDate) : '';
    var idSet = opts.userIdSet;
    return (records || []).filter(function (row) {
      var uid = rowDailyActiveUserId(row);
      if (idSet && !idSet.has(uid)) return false;
      var dt = rowDailyActiveDate(row);
      if (!dt) return false;
      if (start && dt < start) return false;
      if (end && dt > end) return false;
      return true;
    });
  }

  function collectDailyActiveDates(records) {
    var set = new Set();
    (records || []).forEach(function (row) {
      var dt = rowDailyActiveDate(row);
      if (dt) set.add(dt);
    });
    return Array.from(set).sort();
  }

  function countDailyActiveUsersOnDate(records, date) {
    var day = String(date || '').slice(0, 10);
    var count = 0;
    (records || []).forEach(function (row) {
      if (rowDailyActiveDate(row) !== day) return;
      if (!rowDailyActiveIsActive(row)) return;
      count += 1;
    });
    return count;
  }

  function calcActiveDaysForUser(records, userId, startDate, endDate) {
    var uid = String(userId || '').trim();
    if (!uid) return 0;
    var filtered = filterDailyActiveRecords(records, {
      startDate: startDate,
      endDate: endDate,
      userIdSet: new Set([uid]),
    });
    var count = 0;
    filtered.forEach(function (row) {
      if (rowDailyActiveIsActive(row)) count += 1;
    });
    return count;
  }

  function filterDailyActiveByDateRange(records, startDate, endDate) {
    if (Array.isArray(records)) {
      return filterDailyActiveRecords(records, { startDate: startDate, endDate: endDate });
    }
    return filterDailyActiveRecords(normalizeDailyActiveRows([records]), {
      startDate: startDate,
      endDate: endDate,
    });
  }

  function filterDailyActiveByCutoff(records, cutoffDate) {
    return filterDailyActiveByDateRange(records, DATA_PERIOD_START, cutoffDate);
  }

  function getUniqueValues(data, field) {
    if (!Array.isArray(data)) return [];
    var arr = data.map(function (item) {
      return item ? item[field] : undefined;
    });
    return Array.from(new Set(arr)).filter(Boolean);
  }

  function groupBy(data, field) {
    var result = {};
    if (!Array.isArray(data)) return result;
    data.forEach(function (item) {
      if (!item) return;
      var key = item[field];
      var k = key == null ? '' : String(key);
      if (!Object.prototype.hasOwnProperty.call(result, k)) result[k] = [];
      result[k].push(item);
    });
    return result;
  }

  /* ==================== 四、计算函数 ==================== */
  function calcPercent(part, total) {
    var t = Number(total);
    if (!t || t === 0) return 0;
    var p = Number(part);
    var v = (Number.isFinite(p) ? p : 0) / t * 100;
    return Math.round(v * 10) / 10;
  }

  function formatPercent(value) {
    if (value === null || value === undefined) return '--';
    var n = Number(value);
    if (Number.isNaN(n)) return '--';
    if (n <= 1 && n >= 0) n = n * 100;
    return n.toFixed(1) + '%';
  }

  function formatNumber(value) {
    if (value === null || value === undefined) return '--';
    var n = Number(value);
    if (Number.isNaN(n)) return '--';
    return n.toLocaleString();
  }

  /** 汇总 daily_active.learning_duration_min（按筛选学生可选） */
  function calcDailyActiveLearningDurationMinutes(records, opts) {
    opts = opts || {};
    var studentIdSet = opts.studentIdSet;
    var total = 0;
    (records || []).forEach(function (row) {
      var uid = rowDailyActiveUserId(row);
      if (!uid) return;
      if (studentIdSet && !studentIdSet.has(uid)) return;
      total += rowDailyActiveLearningDurationMin(row);
    });
    return total;
  }

  /** 学习总时长：daily_active.learning_duration_min 逐日累加 */
  function calcSessionLearningDurationMinutes(opts) {
    opts = opts || {};
    return calcDailyActiveLearningDurationMinutes(opts.dailyActiveRecords || [], {
      studentIdSet: opts.studentIdSet,
    });
  }

  function formatTotalLearningDuration(totalMin) {
    if (!Number.isFinite(totalMin) || totalMin <= 0) {
      return { value: '0', unit: '分钟' };
    }
    if (totalMin >= 60) {
      return { value: (totalMin / 60).toFixed(1), unit: '小时' };
    }
    return { value: totalMin.toFixed(1), unit: '分钟' };
  }

  function renderMetricCardHtml(value, label, opts) {
    opts = opts || {};
    var extraClass = opts.highlight ? ' metric-card--highlight' : '';
    var attrs = opts.fullWidth ? ' style="grid-column:1/-1;text-align:center;"' : '';
    var unitPart = opts.unit
      ? '<span class="metric-value__unit"> ' + escapeHtml(opts.unit) + '</span>'
      : '';
    return (
      '<div class="metric-card metric-card--stat' +
      extraClass +
      '"' +
      attrs +
      '><div class="metric-value">' +
      value +
      unitPart +
      '</div><div class="metric-label">' +
      escapeHtml(label) +
      '</div></div>'
    );
  }

  function calcActiveDays(dailyActiveInput, startDate, endDate) {
    if (arguments.length === 2) {
      endDate = startDate;
      startDate = DATA_PERIOD_START;
    }
    if (Array.isArray(dailyActiveInput)) return 0;
    if (!dailyActiveInput || typeof dailyActiveInput !== 'object') return 0;
    var uid = rowDailyActiveUserId(dailyActiveInput);
    if (uid && (dailyActiveInput.dt != null || dailyActiveInput['日期'] != null)) {
      return calcActiveDaysForUser([dailyActiveInput], uid, startDate, endDate);
    }
    var records = normalizeDailyActiveRows([dailyActiveInput]);
    if (!records.length) return 0;
    return calcActiveDaysForUser(records, records[0].user_id, startDate, endDate);
  }

  function calcMaxConsecutiveDays(dailyActiveInput, startDate, endDate) {
    if (arguments.length === 2) {
      endDate = startDate;
      startDate = DATA_PERIOD_START;
    }
    var records = Array.isArray(dailyActiveInput)
      ? dailyActiveInput
      : normalizeDailyActiveRows([dailyActiveInput]);
    var uid = records.length ? records[0].user_id : rowDailyActiveUserId(dailyActiveInput);
    if (!uid) return 0;
    var filtered = filterDailyActiveRecords(records, {
      startDate: startDate,
      endDate: endDate,
      userIdSet: new Set([uid]),
    });
    var keys = collectDailyActiveDates(filtered);
    var maxRun = 0;
    var cur = 0;
    keys.forEach(function (key) {
      var row = filtered.find(function (r) {
        return rowDailyActiveDate(r) === key;
      });
      if (row && rowDailyActiveIsActive(row)) {
        cur += 1;
        if (cur > maxRun) maxRun = cur;
      } else {
        cur = 0;
      }
    });
    return maxRun;
  }

  function getPeriodTotalDays(startDate, endDate) {
    var start = new Date(
      String(startDate || DATA_PERIOD_START).slice(0, 10) + 'T00:00:00'
    );
    var end = new Date(String(endDate || DATA_PERIOD_END).slice(0, 10) + 'T00:00:00');
    var diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.min(diff, 31));
  }

  function getCutoffTotalDays(cutoffDate) {
    return getPeriodTotalDays(DATA_PERIOD_START, cutoffDate);
  }

  function hasLearningBehavior(studentId, materialDetail, videoDetail, examDetail, practiceDetail) {
    var id = String(studentId || '').trim();
    if (!id) return false;
    function hasIn(arr) {
      return Array.isArray(arr) && arr.some(function (d) {
        return d && rowStudentId(d) === id;
      });
    }
    return (
      hasIn(materialDetail) || hasIn(videoDetail) || hasIn(examDetail) || hasIn(practiceDetail)
    );
  }

  function hasUsedAnyFunction(usageRow) {
    if (!usageRow || typeof usageRow !== 'object') return false;
    var fields = [
      'view_count',
      'watch_count',
      'practice_count',
      'download_count',
      'photo_search_count',
      'companion_visit_count',
      '浏览次数',
      '观看次数',
      '练习次数',
    ];
    return fields.some(function (f) {
      var n = Number(usageRow[f]);
      return Number.isFinite(n) && n > 0;
    });
  }

  /** reportFrom → 标准 sceneName（与业务平台一致） */
  var REPORT_FROM_SCENE_MAP = {
    2: '资料在线练',
    3: '同步学在线练',
    102: '同步学薄弱再练',
    4: '阶段复习在线练',
    5: '升学备考薄弱再练',
    105: '升学备考精准练',
  };

  var SCENE_NAME_ALIASES = {
    'QBM资料在线练': '资料在线练',
    '资料在线练': '资料在线练',
    '同步学': '同步学在线练',
    '同步学在线练': '同步学在线练',
    '同步学薄弱再练': '同步学薄弱再练',
    '阶段复习': '阶段复习在线练',
    '阶段复习题组在线练': '阶段复习在线练',
    '升学备考-诊薄弱': '升学备考薄弱再练',
    '升学备考-诊薄弱题组在线练': '升学备考薄弱再练',
    '升学备考-精准练': '升学备考精准练',
    '升学备考-精准练题组在线练': '升学备考精准练',
  };

  var PRACTICE_SCENE_CANONICAL = [
    '资料在线练',
    '同步学在线练',
    '同步学薄弱再练',
    '阶段复习在线练',
    '升学备考薄弱再练',
    '升学备考精准练',
  ];

  function normalizeSceneName(scene) {
    var s = scene == null ? '' : String(scene).trim();
    if (!s) return '';
    if (SCENE_NAME_ALIASES[s]) return SCENE_NAME_ALIASES[s];
    return s;
  }

  function formatSceneLabel(scene) {
    var s = normalizeSceneName(scene);
    return s || '--';
  }

  function isExamScene(scene) {
    var list = ['刷真题', '月考', '期中', '期末'];
    var s = scene == null ? '' : String(scene).trim();
    return list.indexOf(s) !== -1;
  }

  function isPracticeScene(scene) {
    var s = normalizeSceneName(scene);
    if (!s || s === '刷真题') return false;
    if (PRACTICE_SCENE_CANONICAL.indexOf(s) !== -1) return true;
    return s.indexOf('在线练') >= 0 || s.indexOf('薄弱再练') >= 0 || s.indexOf('精准练') >= 0;
  }

  function calcCorrectRate(details) {
    if (!Array.isArray(details) || details.length === 0) return null;
    var totalQ = 0;
    var correctSum = 0;
    details.forEach(function (row) {
      if (!row) return;
      var tq = Number(row.total_questions != null ? row.total_questions : row['总题数']);
      var wc = Number(row.wrong_count != null ? row.wrong_count : row['错题数']);
      if (!Number.isFinite(tq) || tq <= 0) return;
      var wrong = Number.isFinite(wc) && wc >= 0 ? wc : 0;
      totalQ += tq;
      correctSum += tq - wrong;
    });
    if (totalQ === 0) return null;
    return correctSum / totalQ;
  }

  function getStatusTag(activeDays, correctRate, totalDays) {
    totalDays = totalDays || getCutoffTotalDays(AppState.getCutoffDate());
    var days = Number(activeDays);
    var d = Number.isFinite(days) && days >= 0 ? days : 0;
    var rateNull =
      correctRate === null ||
      correctRate === undefined ||
      (typeof correctRate === 'number' && Number.isNaN(correctRate));
    var rate = rateNull ? null : Number(correctRate);

    if (d === 0) return { text: '未参与', class: 'tag-gray' };
    if (rateNull || rate === null || Number.isNaN(rate)) {
      if (d >= totalDays * 0.3) return { text: '一般', class: 'tag-warning' };
      return { text: '需关注', class: 'tag-error' };
    }
    if (d >= totalDays * 0.7 && rate >= 0.8) return { text: '优秀', class: 'tag-success' };
    if (d >= totalDays * 0.5 && rate >= 0.7) return { text: '良好', class: 'tag-good' };
    if (d >= totalDays * 0.3) return { text: '一般', class: 'tag-warning' };
    if (rate < 0.6) return { text: '需关注', class: 'tag-error' };
    return { text: '需关注', class: 'tag-error' };
  }

  function getRateColor(rate) {
    if (rate === null || rate === undefined) return 'var(--text-light)';
    var r = Number(rate);
    if (Number.isNaN(r)) return 'var(--text-light)';
    if (r >= 0.8) return 'var(--success)';
    if (r >= 0.6) return 'var(--warning)';
    return 'var(--error)';
  }

  /* ==================== 题目原题查看 ==================== */
  var PAPER_QUESTION_BANK = {
    '科学|力与运动': [
      {
        stem: '下列现象中，不能说明物体间存在力的作用的是（　　）',
        options: ['苹果从树上落下', '磁铁吸引铁钉', '太阳东升西落', '人用手推门'],
        answer: 'C',
        analysis: '太阳东升西落是地球自转引起的自然现象，不是物体间的相互作用力。',
      },
      {
        stem: '关于惯性，下列说法正确的是（　　）',
        options: [
          '静止的物体没有惯性',
          '运动的物体惯性比静止时大',
          '一切物体都具有惯性',
          '只有受力时才有惯性',
        ],
        answer: 'C',
        analysis: '惯性是物体的固有属性，一切物体无论运动还是静止都具有惯性。',
      },
      {
        stem: '在水平面上匀速直线行驶的自行车，其动力与阻力的关系是（　　）',
        options: ['动力大于阻力', '动力小于阻力', '动力等于阻力', '无法判断'],
        answer: 'C',
        analysis: '匀速直线运动处于平衡状态，水平方向动力与阻力大小相等、方向相反。',
      },
      {
        stem: '下列做法中，属于增大摩擦的是（　　）',
        options: ['给自行车轴加润滑油', '在冰面上撒沙子', '用滚动轴承代替滑动轴承', '气垫船行驶'],
        answer: 'B',
        analysis: '在冰面上撒沙子可增大接触面粗糙程度，从而增大摩擦。',
      },
      {
        stem: '用弹簧测力计水平拉木块做匀速直线运动，测力计示数为 5 N，则木块受到的摩擦力为（　　）',
        options: ['0 N', '2.5 N', '5 N', '10 N'],
        answer: 'C',
        analysis: '匀速运动时拉力与摩擦力平衡，大小相等，均为 5 N。',
      },
      {
        stem: '下列关于重力的说法，错误的是（　　）',
        options: ['重力方向竖直向下', '重力大小与质量有关', '重力就是地球对物体的吸引力', '重力的施力物体是地球'],
        answer: 'C',
        analysis: '重力是地球对物体的引力在竖直方向的分力，不能简单等同于地球对物体的吸引力。',
      },
      {
        stem: '乘客在急刹车时身体前倾，这是因为（　　）',
        options: ['刹车力使身体向前', '人具有惯性，下半身随车减速而上身保持原运动状态', '座椅对人有向前的推力', '重力发生了变化'],
        answer: 'B',
        analysis: '急刹车时下半身随车减速，上半身由于惯性仍保持原来的运动状态，故前倾。',
      },
      {
        stem: '两个物体相互接触，下列情况一定存在弹力的是（　　）',
        options: ['两物体间有压力且发生弹性形变', '两物体相互挤压', '两物体相对静止', '两物体间有摩擦力'],
        answer: 'A',
        analysis: '弹力产生的条件是相互接触且发生弹性形变，同时物体间有挤压（压力）。',
      },
      {
        stem: '在光滑水平面上，对静止的物体施加 10 N 的水平推力，物体将（　　）',
        options: ['保持静止', '做匀速直线运动', '做加速直线运动', '先加速后匀速'],
        answer: 'C',
        analysis: '光滑水平面无摩擦，物体受不平衡力作用，将做加速直线运动。',
      },
      {
        stem: '一辆汽车在平直公路上匀速行驶，在水平方向上受到的两个力是（　　）',
        options: ['牵引力与重力', '牵引力与阻力', '重力与支持力', '支持力与阻力'],
        answer: 'B',
        analysis: '水平方向匀速运动时，牵引力与阻力大小相等；重力与支持力在竖直方向平衡。',
      },
      {
        stem: '用 20 N 的力竖直向上提一个重 15 N 的物体，物体受到的合力为（　　）',
        options: ['5 N，方向向上', '5 N，方向向下', '35 N，方向向上', '0 N'],
        answer: 'A',
        analysis: '合力 F = 20 N − 15 N = 5 N，方向竖直向上。',
      },
      {
        stem: '下列关于力的三要素的说法，正确的是（　　）',
        options: ['力的大小、方向、作用点', '力的大小、速度、方向', '力的方向、作用点、时间', '力的大小、质量、方向'],
        answer: 'A',
        analysis: '力的三要素是力的大小、方向和作用点，它们都能影响力的作用效果。',
      },
    ],
    '数学|绝对值': [
      {
        stem: '|-3| 的值是（　　）',
        options: ['-3', '3', '±3', '0'],
        answer: 'B',
        analysis: '负数的绝对值等于它的相反数，|-3| = 3。',
      },
      {
        stem: '若 |a| = 5，则 a 的值是（　　）',
        options: ['5', '-5', '5 或 -5', '0'],
        answer: 'C',
        analysis: '绝对值为 5 的数有两个：5 和 -5。',
      },
    ],
    '语文|文言文翻译': [
      {
        stem: '「学而时习之，不亦说乎」中「说」的正确解释是（　　）',
        options: ['说话', '高兴', '说明', '劝说'],
        answer: 'B',
        analysis: '「说」通「悦」，意为高兴、愉快。',
      },
    ],
    '英语|there be句型': [
      {
        stem: 'There ___ a book and two pens on the desk.',
        options: ['is', 'are', 'be', 'have'],
        answer: 'A',
        analysis: 'there be 句型遵循就近原则，a book 为单数，用 is。',
      },
    ],
  };

  function getPaperQuestion(meta, questionNo) {
    var num = parseInt(questionNo, 10);
    if (!Number.isFinite(num) || num < 1) num = 1;
    var subject = String(meta && meta.subject ? meta.subject : '').trim();
    var kp = String(
      meta && meta.knowledge_point
        ? meta.knowledge_point
        : meta && meta.chapter
          ? meta.chapter
          : ''
    ).trim();
    var paperName = String(meta && meta.paper_name ? meta.paper_name : '').trim();
    var bank = PAPER_QUESTION_BANK[subject + '|' + kp] || PAPER_QUESTION_BANK[subject] || null;
    if (bank && bank.length) {
      return Object.assign({ questionNo: num, paperName: paperName, subject: subject }, bank[(num - 1) % bank.length]);
    }
    return {
      questionNo: num,
      paperName: paperName,
      subject: subject,
      stem:
        '（第 ' +
        num +
        ' 题）' +
        (paperName || '本套作业') +
        '相关练习。题干内容以学科平台原题为准。',
      options: ['A. 选项一', 'B. 选项二', 'C. 选项三', 'D. 选项四'],
      answer: 'A',
      analysis: '暂无解析，请登录学科平台查看完整原题与解析。',
    };
  }

  var DEFAULT_ZUJUAN_BANK_ID = '11';
  var DEFAULT_ZUJUAN_QUESTION_ID = '33474302';
  var ZUJUAN_QUESTION_ID_BASE = 33474302;
  var paperQuestionMetaMap = {};
  var paperQuestionIdReverseMap = {};

  function paperQuestionMapKey(paperId, questionNo) {
    return String(paperId || '').trim() + '|' + String(parseInt(questionNo, 10));
  }

  function parseWrongIds(field) {
    if (field == null || field === '') return [];
    var s = String(field).trim();
    if (!s || s.toLowerCase() === 'null' || s === '\\N') return [];
    return s
      .replace(/"/g, '')
      .split(/[,，\s]+/)
      .map(function (x) {
        return String(x).trim();
      })
      .filter(Boolean);
  }

  /** 考试/练习是否已交卷（兼容 is_submit / is_submitted） */
  function isExamSubmitted(row) {
    if (!row) return false;
    var v =
      row.is_submit != null && row.is_submit !== ''
        ? String(row.is_submit).trim()
        : row.is_submitted != null && row.is_submitted !== ''
          ? String(row.is_submitted).trim()
          : String(row['是否提交'] || '').trim();
    if (!v) return true;
    if (v.indexOf('已交卷') >= 0) return true;
    if (v.indexOf('未交卷') >= 0) return false;
    return v === '是' || v === '1' || v.toLowerCase() === 'true';
  }

  /** wrong_question_ids（试题 ID）→ 卷内题号列表；兼容旧数据中的纯数字题号 */
  function resolveWrongQuestionNos(paperId, wrongIdsField) {
    var ids = parseWrongIds(wrongIdsField);
    var pid = String(paperId != null ? paperId : '').trim();
    var out = [];
    ids.forEach(function (id) {
      var rev = paperQuestionIdReverseMap[id];
      if (rev && String(rev.paperId) === pid) {
        out.push(rev.questionNo);
        return;
      }
      if (/^\d{1,3}$/.test(id)) {
        out.push(parseInt(id, 10));
      }
    });
    return out;
  }

  function recordHasWrongQuestionNo(paperId, wrongIdsField, questionNo) {
    var nos = resolveWrongQuestionNos(paperId, wrongIdsField);
    return nos.indexOf(parseInt(questionNo, 10)) !== -1;
  }

  /** 加载 paper_questions.csv：paper_id + question_no → bank_id / id / qbm_id */
  function setPaperQuestionMap(rows) {
    paperQuestionMetaMap = {};
    paperQuestionIdReverseMap = {};
    (rows || []).forEach(function (row) {
      if (!row) return;
      var paperId = String(
        row.paper_id != null ? row.paper_id : row['试卷ID'] || row['paperId'] || ''
      ).trim();
      var questionNo = parseInt(
        row.question_no != null ? row.question_no : row['题号'] || row['questionNo'],
        10
      );
      var zujuanId = String(
        row.id != null && row.id !== ''
          ? row.id
          : row.question_id != null
            ? row.question_id
            : row['试题ID'] || row['questionId'] || ''
      ).trim();
      var bankId = String(
        row.bank_id != null && row.bank_id !== ''
          ? row.bank_id
          : row['学科ID'] || row['bankId'] || DEFAULT_ZUJUAN_BANK_ID
      ).trim();
      var qbmId = String(
        row.qbm_id != null && row.qbm_id !== '' ? row.qbm_id : row['QBM试卷ID'] || paperId
      ).trim();
      if (!paperId || !Number.isFinite(questionNo) || questionNo < 1 || !zujuanId) return;
      paperQuestionMetaMap[paperQuestionMapKey(paperId, questionNo)] = {
        bank_id: bankId,
        id: zujuanId,
        qbm_id: qbmId,
      };
      paperQuestionIdReverseMap[zujuanId] = { paperId: paperId, questionNo: questionNo };
    });
  }

  function getPaperQuestionMeta(paperId, questionNo) {
    var no = parseInt(questionNo, 10);
    if (!Number.isFinite(no) || no < 1) return null;
    return paperQuestionMetaMap[paperQuestionMapKey(paperId, no)] || null;
  }

  /** 归一化组卷网 URL 路径段（兼容旧 11q33474302 格式） */
  function normalizeZujuanQuestionId(questionId) {
    var id = String(questionId != null ? questionId : '').trim();
    if (!id) return DEFAULT_ZUJUAN_BANK_ID + 'q' + DEFAULT_ZUJUAN_QUESTION_ID;
    if (/^\d+q\d+$/i.test(id)) return id.toLowerCase();
    return id;
  }

  /** 由 bank_id + id 构造组卷网题目页：https://zujuan.xkw.com/{bank_id}q{id}.html */
  function buildZujuanQuestionUrl(bankId, questionId) {
    if (arguments.length === 1) {
      var legacy = normalizeZujuanQuestionId(bankId);
      if (/^\d+q\d+$/i.test(legacy)) {
        return 'https://zujuan.xkw.com/' + legacy + '.html';
      }
      return buildZujuanQuestionUrl(DEFAULT_ZUJUAN_BANK_ID, legacy);
    }
    var bank = String(bankId != null && bankId !== '' ? bankId : DEFAULT_ZUJUAN_BANK_ID).trim();
    var qid = String(questionId != null ? questionId : '').trim();
    if (!qid) qid = DEFAULT_ZUJUAN_QUESTION_ID;
    return 'https://zujuan.xkw.com/' + bank + 'q' + qid + '.html';
  }

  /** 由试卷 + 卷内题号解析组卷网 URL 路径段 bank_id + q + id */
  function getPaperQuestionZujuanId(paperId, questionNo) {
    var meta = getPaperQuestionMeta(paperId, questionNo);
    if (meta && meta.bank_id && meta.id) {
      return String(meta.bank_id) + 'q' + String(meta.id);
    }
    var no = parseInt(questionNo, 10);
    if (!Number.isFinite(no) || no < 1) {
      return DEFAULT_ZUJUAN_BANK_ID + 'q' + DEFAULT_ZUJUAN_QUESTION_ID;
    }
    var seed = 0;
    var raw = String(paperId || '');
    for (var i = 0; i < raw.length; i++) {
      seed = (seed * 31 + raw.charCodeAt(i)) >>> 0;
    }
    var paperOffset = (seed % 500) * 20;
    return DEFAULT_ZUJUAN_BANK_ID + 'q' + String(ZUJUAN_QUESTION_ID_BASE + paperOffset + no - 1);
  }

  /** 由试卷 + 卷内题号构造组卷网题目详情页 URL */
  function getPaperQuestionZujuanUrl(paperId, questionNo) {
    var meta = getPaperQuestionMeta(paperId, questionNo);
    if (meta && meta.bank_id && meta.id) {
      return buildZujuanQuestionUrl(meta.bank_id, meta.id);
    }
    return buildZujuanQuestionUrl(getPaperQuestionZujuanId(paperId, questionNo));
  }

  function ensureQuestionModal() {
    var modal = document.getElementById('questionModal');
    if (modal) return modal;
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="question-modal" id="questionModal" hidden>' +
        '<div class="question-modal__backdrop" onclick="closeQuestionModal()"></div>' +
        '<div class="question-modal__panel" role="dialog" aria-modal="true" aria-labelledby="questionModalTitle">' +
        '<div class="question-modal__head">' +
        '<h3 class="question-modal__title" id="questionModalTitle">题目详情</h3>' +
        '<button type="button" class="question-modal__close" onclick="closeQuestionModal()" aria-label="关闭">×</button>' +
        '</div>' +
        '<div class="question-modal__body" id="questionModalBody"></div>' +
        '</div></div>'
    );
    return document.getElementById('questionModal');
  }

  function renderQuestionModalContent(question) {
    var html =
      '<div class="question-modal__meta">' +
      escapeHtml(question.paperName || '') +
      (question.subject ? ' · ' + escapeHtml(question.subject) : '') +
      '</div>' +
      '<div class="question-modal__stem">' +
      escapeHtml(question.stem) +
      '</div>';
    if (question.options && question.options.length) {
      html += '<ul class="question-modal__options">';
      question.options.forEach(function (opt, idx) {
        var label = String.fromCharCode(65 + idx);
        var text = String(opt).replace(/^[A-D][.、．\s]*/, '');
        html +=
          '<li class="question-modal__option"><span class="question-modal__option-label">' +
          label +
          '.</span> ' +
          escapeHtml(text) +
          '</li>';
      });
      html += '</ul>';
    }
    if (question.answer) {
      html +=
        '<div class="question-modal__answer"><span class="question-modal__label">参考答案</span>' +
        escapeHtml(question.answer) +
        '</div>';
    }
    if (question.analysis) {
      html +=
        '<div class="question-modal__analysis"><span class="question-modal__label">解析</span>' +
        escapeHtml(question.analysis) +
        '</div>';
    }
    return html;
  }

  function openQuestionModal(meta, questionNo) {
    var question = getPaperQuestion(meta, questionNo);
    var modal = ensureQuestionModal();
    var title = document.getElementById('questionModalTitle');
    var body = document.getElementById('questionModalBody');
    if (title) title.textContent = '第 ' + question.questionNo + ' 题';
    if (body) body.innerHTML = renderQuestionModalContent(question);
    modal.hidden = false;
    document.body.classList.add('question-modal-open');
    if (!modal._escBound) {
      modal._escBound = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeQuestionModal();
      });
    }
  }

  function closeQuestionModal() {
    var modal = document.getElementById('questionModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('question-modal-open');
  }

  function getErrorRateClass(rate) {
    if (rate === null || rate === undefined || Number.isNaN(Number(rate))) {
      return 'tag-gray';
    }
    var r = Number(rate);
    if (r > 0.6) return 'tag-error';
    if (r > 0.4) return 'tag-warning';
    return 'tag-success';
  }

  function getErrorRateTag(rate) {
    if (rate === null || rate === undefined || Number.isNaN(Number(rate))) {
      return { class: 'tag-gray', text: '--' };
    }
    var r = Number(rate);
    var text = formatPercent(r * 100);
    return { class: getErrorRateClass(r), text: text };
  }

  /* ==================== 五、权限相关 ==================== */
  function filterByPermission(students) {
    if (!Array.isArray(students)) return [];
    var school = AppState.getSchool();
    var filtered = filterBySchool(students, school);
    var user = AppState.getUser();
    if (!user) return filtered;

    if (AppState.isFrontline()) {
      var grade = AppState.getGrade();
      if (grade) filtered = filterByGrade(filtered, grade);
      var visible = AppState.getAllVisibleClasses();
      if (visible.length > 0) {
        filtered = filtered.filter(function (row) {
          return visible.indexOf(rowClassName(row)) !== -1;
        });
      }
    }

    return filtered;
  }

  function getVisibleGrades(students) {
    var school = AppState.getSchool();
    var filtered = filterBySchool(students, school);

    if (AppState.isFrontline()) {
      var grade = AppState.getGrade();
      return grade ? [grade] : sortGradesAsc(uniqueFieldValues(filtered, 'grade', '年级'));
    }

    var grades = sortGradesAsc(uniqueFieldValues(filtered, 'grade', '年级'));

    return grades;
  }

  function getVisibleClasses(students, grade) {
    var school = AppState.getSchool();
    var filtered = filterBySchool(students, school);
    if (grade) filtered = filterByGrade(filtered, grade);

    if (AppState.isFrontline()) {
      var visibleClasses = AppState.getAllVisibleClasses();
      if (visibleClasses.length > 0) {
        var allClasses = uniqueFieldValues(filtered, 'class_name', '班级');
        return allClasses.filter(function (c) {
          return visibleClasses.indexOf(c) !== -1;
        });
      }
    }

    return uniqueFieldValues(filtered, 'class_name', '班级');
  }

  function getVisibleSubjects(className, examDetail, practiceDetail, materialDetail, videoDetail) {
    var allSubjects = new Set();
    [examDetail, practiceDetail, materialDetail, videoDetail].forEach(function (data) {
      if (!Array.isArray(data)) return;
      data.forEach(function (d) {
        var subj = rowSubject(d);
        if (subj) allSubjects.add(subj);
      });
    });

    var subjects = Array.from(allSubjects);

    if (AppState.isFrontline()) {
      var mySubject = AppState.getSubject();
      if (mySubject && !AppState.isManageClass(className)) {
        return subjects.filter(function (s) {
          return s === mySubject;
        });
      }
    }

    return sortSubjectsAsc(subjects);
  }

  function shouldLockSubject(className) {
    if (AppState.isManagement()) return false;
    if (AppState.isManageClass(className)) return false;
    return !!AppState.getSubject();
  }

  function getDefaultSubject(className) {
    if (shouldLockSubject(className)) return AppState.getSubject();
    return '';
  }

  /* ==================== 六、页面布局 ==================== */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--';
    var d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return d.getMonth() + 1 + '月' + d.getDate() + '日 ' + h + ':' + m;
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '--';
    var key = normalizeDateKey(dateStr);
    if (!key) return '--';
    var parts = key.split('-');
    if (parts.length === 3) {
      return parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
    }
    var d = new Date(key);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return d.getMonth() + 1 + '/' + d.getDate();
  }

  function onCutoffDateChange(newDate) {
    AppState.setCutoffDate(newDate);
    global.location.reload();
  }

  function onDateRangeApply() {
    var startEl = document.getElementById('dateRangeStart');
    var endEl = document.getElementById('dateRangeEnd');
    if (!startEl || !endEl) return;
    var start = startEl.value;
    var end = endEl.value;
    if (!start || !end) {
      alert('请选择完整的起止日期');
      return;
    }
    if (start > end) {
      alert('开始日期不能晚于结束日期');
      return;
    }
    AppState.setDateRange(start, end);
    global.location.reload();
  }

  function mountPageDateRangeBar() {
    var bar =
      document.getElementById('headerDateRangeBar') || document.getElementById('pageDateRangeBar');
    if (!bar) return;
    var range = AppState.getDateRange();
    bar.innerHTML =
      '<span class="page-date-range__label">数据时段</span>' +
      '<input type="date" id="dateRangeStart" class="select page-date-range__input" value="' +
      escapeHtml(range.start) +
      '" min="' +
      DATA_PERIOD_START +
      '" max="' +
      DATA_PERIOD_END +
      '" />' +
      '<span class="page-date-range__sep">至</span>' +
      '<input type="date" id="dateRangeEnd" class="select page-date-range__input" value="' +
      escapeHtml(range.end) +
      '" min="' +
      DATA_PERIOD_START +
      '" max="' +
      DATA_PERIOD_END +
      '" />' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="onDateRangeApply()">应用</button>' +
      '<span class="page-date-range__hint">展示该时段内的数据</span>';
  }

  function renderHeader() {
    var user = AppState.getUser();
    var brand = getSchoolBrand(AppState.getSchool());
    var displaySchool = escapeHtml(brand.displayName || AppState.getSchool());
    var logoHref = brand.logoFile
      ? escapeHtml(resolveAssetHref(brand.logoFile, SCHOOL_LOGO_CACHE_BUST))
      : '';

    var roleTagClass = 'tag-gray';
    if (user) {
      if (user.user_level === '管理层' || AppState.isManagement()) roleTagClass = 'tag-success';
      else roleTagClass = 'tag-warning';
    }

    var logoHtml = logoHref
      ? '<img class="header-school-logo" src="' +
        logoHref +
        '" alt="" decoding="async" fetchpriority="high" />'
      : '';

    var roleText = user ? escapeHtml(user.role || '') : '';
    var nameText = user ? escapeHtml(user.name || '') : '未登录';
    var subjectHint = '';
    if (user && user.subject && AppState.isFrontline()) {
      subjectHint =
        '<span style="margin-left:6px;font-size:12px;color:var(--text-light);">· ' +
        escapeHtml(user.subject) +
        '</span>';
    }

    return (
      '<div class="header-left">' +
      '<div class="header-school-identity">' +
      logoHtml +
      '<span class="header-brand">' +
      displaySchool +
      '</span>' +
      '</div>' +
      '<span class="header-sep"></span>' +
      '<span class="header-title">学情数据看板</span>' +
      '<div id="headerDateRangeBar" class="header-date-range"></div>' +
      '</div>' +
      '<div class="header-center">' +
      '<span class="header-school" style="display:none;">' +
      displaySchool +
      '</span>' +
      '</div>' +
      '<div class="header-right">' +
      (user ? '<span class="tag ' + roleTagClass + '">' + roleText + '</span>' : '') +
      '<span style="margin-left:8px;color:var(--text-secondary);">' +
      nameText +
      subjectHint +
      '</span>' +
      '<button type="button" class="btn btn-outline btn-sm" style="margin-left:12px;" onclick="AppState.logout()">退出</button>' +
      '</div>'
    );
  }

  function renderSidebarMenuItem(item, activePage) {
    var active = item.id === activePage ? ' active' : '';
    var ab = item.abbr ? escapeHtml(item.abbr) : '';
    return (
      '<a href="' +
      escapeHtml(item.href) +
      '" class="menu-item' +
      active +
      '">' +
      (ab ? '<span class="menu-icon menu-icon--abbr" aria-hidden="true">' + ab + '</span>' : '') +
      '<span class="menu-label">' +
      escapeHtml(item.label) +
      '</span></a>'
    );
  }

  function renderSidebar(activePage) {
    var items = [];

    if (AppState.isManagement()) {
      items.push({ id: 'cockpit', label: '学校驾驶舱', abbr: '校', href: 'cockpit.html' });
    }
    items.push({ id: 'diagnosis', label: '班级管理', abbr: '班', href: CLASS_BOARD_PAGE });

    return (
      '<nav class="sidebar-nav" aria-label="主导航">' +
      items.map(function (item) {
        return renderSidebarMenuItem(item, activePage);
      }).join('') +
      '</nav>'
    );
  }

  /** 从账号表刷新当前用户的授课班级等字段（修复旧版登录缓存缺少 teach_classes） */
  function syncCurrentUserProfile() {
    var user = AppState.getUser();
    if (!user || !user.name) return Promise.resolve(user);
    return DataLoader.accounts()
      .then(function (accounts) {
        if (!Array.isArray(accounts) || !accounts.length) return user;
        var name = String(user.name).trim();
        var row = accounts.find(function (a) {
          if (!a) return false;
          return readAccountField(a, '用户名') === name;
        });
        if (!row) return user;
        var updated = Object.assign({}, user, {
          role: readAccountField(row, '用户身份') || user.role || '',
          user_level: readAccountField(row, '用户分层') || user.user_level || '',
          name: readAccountField(row, '用户名') || user.name || '',
          school_name: readAccountField(row, '学校名称') || user.school_name || '',
          campus: readAccountField(row, '所属校区') || user.campus || '',
          grade: readAccountField(row, '年级') || user.grade || '',
          manage_class: readAccountField(row, '管理班级') || '',
          teach_classes: readAccountField(row, '授课班级') || '',
          subject: readAccountField(row, '学科') || user.subject || '',
          class_name: readAccountField(row, '管理班级') || user.class_name || '',
        });
        AppState.setUser(updated);
        return updated;
      })
      .catch(function (e) {
        console.warn('syncCurrentUserProfile failed', e);
        return user;
      });
  }

  function checkAuth() {
    if (!AppState.getUser()) {
      global.location.href = 'index.html';
      return false;
    }
    if (!AppState.getSchool()) {
      global.location.href = 'index.html';
      return false;
    }
    try {
      var u = AppState.getUser();
      if (u) AppState.setUser(u);
    } catch (e) {
      console.warn('checkAuth: normalize user failed', e);
    }
    return true;
  }

  function initDashboardLayout(activePage) {
    if (!checkAuth()) return false;
    var headerEl = document.getElementById('header');
    var sidebarEl = document.getElementById('sidebar');
    if (headerEl) headerEl.innerHTML = renderHeader();
    if (sidebarEl) sidebarEl.innerHTML = renderSidebar(activePage);
    mountPageDateRangeBar();
    applyPageBranding();
    return true;
  }

  /* ==================== 七、表格排序 ==================== */
  function sortTable(tableId, columnIndex, type) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var tbody = table.tBodies && table.tBodies[0];
    if (!tbody) return;

    var sortType = type === 'number' ? 'number' : 'string';
    var col = Number(columnIndex);
    var current = table.getAttribute('data-sort') || '';
    var newDir = current === String(col) + '-asc' ? 'desc' : 'asc';
    table.setAttribute('data-sort', col + '-' + newDir);
    var direction = newDir === 'asc' ? 1 : -1;

    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr:not(.sub-table-row)'));

    function cellValue(tr) {
      var cells = tr.cells;
      if (!cells || col < 0 || col >= cells.length) return '';
      return cells[col] ? cells[col].textContent.trim() : '';
    }

    function parseSortable(raw) {
      if (raw === '--' || raw === '') return sortType === 'number' ? -999 : raw;
      if (sortType === 'number') {
        return parseFloat(String(raw).replace(/%/g, '').replace(/天/g, '').replace(/次/g, '')) || -999;
      }
      return raw;
    }

    rows.sort(function (a, b) {
      var va = parseSortable(cellValue(a));
      var vb = parseSortable(cellValue(b));
      if (sortType === 'number') {
        return (va - vb) * direction;
      }
      return String(va).localeCompare(String(vb), 'zh-CN') * direction;
    });

    rows.forEach(function (tr) {
      tbody.appendChild(tr);
    });
  }

  /* ==================== 八、Tab 切换 ==================== */
  function switchTab(tabGroupId, tabIndex) {
    var root = document.getElementById(tabGroupId);
    if (!root) return;
    var tabs = root.querySelectorAll('.tab');
    var contents = root.querySelectorAll('.tab-content');
    tabs.forEach(function (t, i) {
      t.classList.toggle('active', i === tabIndex);
    });
    contents.forEach(function (c, i) {
      c.classList.toggle('active', i === tabIndex);
    });
  }

  /* ==================== 九、展开/收起 ==================== */
  function toggleExpand(rowId) {
    var row = document.getElementById(rowId);
    if (!row) return;
    var expanded = row.classList.toggle('show');
    var prev = row.previousElementSibling;
    if (prev) {
      var btn = prev.querySelector('.expand-btn');
      if (btn) btn.textContent = expanded ? '收起' : '展开';
    }
  }

  /* ==================== 十、分页 ==================== */
  function renderPagination(containerId, currentPage, totalPages, onPageChange) {
    var container = document.getElementById(containerId);
    if (!container || typeof onPageChange !== 'function') return;

    var total = Math.max(1, Math.floor(Number(totalPages)) || 1);
    var cur = Math.floor(Number(currentPage)) || 1;
    if (cur < 1) cur = 1;
    if (cur > total) cur = total;

    var startPage = Math.max(1, cur - 2);
    var endPage = Math.min(total, startPage + 4);
    startPage = Math.max(1, endPage - 4);

    var parts = [];
    parts.push(
      '<button type="button" class="page-btn" data-page="prev"' +
        (cur <= 1 ? ' disabled' : '') +
        '>上一页</button>'
    );

    if (startPage > 1) {
      parts.push('<button type="button" class="page-btn" data-page="1">1</button>');
      if (startPage > 2) parts.push('<span style="padding:0 4px;">...</span>');
    }

    for (var p = startPage; p <= endPage; p++) {
      parts.push(
        '<button type="button" class="page-btn' +
          (p === cur ? ' active' : '') +
          '" data-page="' +
          p +
          '">' +
          p +
          '</button>'
      );
    }

    if (endPage < total) {
      if (endPage < total - 1) parts.push('<span style="padding:0 4px;">...</span>');
      parts.push(
        '<button type="button" class="page-btn" data-page="' + total + '">' + total + '</button>'
      );
    }

    parts.push(
      '<button type="button" class="page-btn" data-page="next"' +
        (cur >= total ? ' disabled' : '') +
        '>下一页</button>'
    );

    container.innerHTML = parts.join('');
    container.onclick = function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'BUTTON' || !t.classList.contains('page-btn')) return;
      var dp = t.getAttribute('data-page');
      if (dp === 'prev') {
        if (cur > 1) onPageChange(cur - 1);
        return;
      }
      if (dp === 'next') {
        if (cur < total) onPageChange(cur + 1);
        return;
      }
      var num = parseInt(dp, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= total) onPageChange(num);
    };
  }

  /* ==================== 导出到全局 ==================== */
  global.AppState = AppState;
  global.readAccountField = readAccountField;
  global.getSchoolBrand = getSchoolBrand;
  global.ensureSchoolBrands = ensureSchoolBrands;
  global.formatTenantText = formatTenantText;
  global.applyTenantToRows = applyTenantToRows;
  global.applyLoginPageBranding = applyLoginPageBranding;
  global.applyPageBranding = applyPageBranding;
  global.loadCSV = loadCSV;
  global.DataLoader = DataLoader;

  global.rowStudentId = rowStudentId;
  global.rowStudentName = rowStudentName;
  global.rowSchoolName = rowSchoolName;
  global.rowGradeVal = rowGradeVal;
  global.rowClassName = rowClassName;
  global.rowSubject = rowSubject;
  global.rowTimeValue = rowTimeValue;

  global.filterBySchool = filterBySchool;
  global.filterByGrade = filterByGrade;
  global.filterByClass = filterByClass;
  global.filterBySubject = filterBySubject;
  global.filterByStudentId = filterByStudentId;
  global.filterByStudentIds = filterByStudentIds;
  function buildActiveTrendChartGrid(labels) {
    var many = Array.isArray(labels) && labels.length > 20;
    return {
      left: 48,
      right: 48,
      top: 44,
      bottom: many ? 48 : 36,
      containLabel: false,
    };
  }

  function buildActiveTrendYAxis() {
    return {
      type: 'value',
      name: '人数',
      min: 0,
      minInterval: 1,
      nameLocation: 'end',
      nameGap: 10,
      nameTextStyle: { color: '#6B7280', fontSize: 12, align: 'right' },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      axisLabel: { color: '#6B7280', margin: 8 },
    };
  }

  global.buildActiveTrendChartGrid = buildActiveTrendChartGrid;
  global.buildActiveTrendYAxis = buildActiveTrendYAxis;
  global.filterByCutoffDate = filterByCutoffDate;
  global.filterByDateRange = filterByDateRange;
  global.normalizeDateKey = normalizeDateKey;
  global.normalizeDailyActiveRows = normalizeDailyActiveRows;
  global.rowDailyActiveUserId = rowDailyActiveUserId;
  global.rowDailyActiveDate = rowDailyActiveDate;
  global.rowDailyActiveIsActive = rowDailyActiveIsActive;
  global.rowDailyActiveLearningDurationMin = rowDailyActiveLearningDurationMin;
  global.calcDailyActiveLearningDurationMinutes = calcDailyActiveLearningDurationMinutes;
  global.filterDailyActiveRecords = filterDailyActiveRecords;
  global.collectDailyActiveDates = collectDailyActiveDates;
  global.countDailyActiveUsersOnDate = countDailyActiveUsersOnDate;
  global.calcActiveDaysForUser = calcActiveDaysForUser;
  global.filterDailyActiveByCutoff = filterDailyActiveByCutoff;
  global.filterDailyActiveByDateRange = filterDailyActiveByDateRange;
  global.getPeriodTotalDays = getPeriodTotalDays;
  global.DATA_PERIOD_START = DATA_PERIOD_START;
  global.DATA_PERIOD_END = DATA_PERIOD_END;
  global.getUniqueValues = getUniqueValues;
  global.groupBy = groupBy;

  global.calcPercent = calcPercent;
  global.formatPercent = formatPercent;
  global.formatNumber = formatNumber;
  global.rowMaterialTitle = rowMaterialTitle;
  global.rowCatalogNames = rowCatalogNames;
  global.rowContentType = rowContentType;
  global.isNullishCsvValue = isNullishCsvValue;
  global.calcSessionLearningDurationMinutes = calcSessionLearningDurationMinutes;
  global.formatTotalLearningDuration = formatTotalLearningDuration;
  global.setPaperQuestionMap = setPaperQuestionMap;
  global.parseWrongIds = parseWrongIds;
  global.isExamSubmitted = isExamSubmitted;
  global.resolveWrongQuestionNos = resolveWrongQuestionNos;
  global.recordHasWrongQuestionNo = recordHasWrongQuestionNo;
  global.renderMetricCardHtml = renderMetricCardHtml;
  global.calcActiveDays = calcActiveDays;
  global.calcMaxConsecutiveDays = calcMaxConsecutiveDays;
  global.getCutoffTotalDays = getCutoffTotalDays;
  global.hasLearningBehavior = hasLearningBehavior;
  global.hasUsedAnyFunction = hasUsedAnyFunction;
  global.isExamScene = isExamScene;
  global.REPORT_FROM_SCENE_MAP = REPORT_FROM_SCENE_MAP;
  global.normalizeSceneName = normalizeSceneName;
  global.formatSceneLabel = formatSceneLabel;
  global.isPracticeScene = isPracticeScene;
  global.calcCorrectRate = calcCorrectRate;
  global.getStatusTag = getStatusTag;
  global.getRateColor = getRateColor;
  global.getPaperQuestion = getPaperQuestion;
  global.buildZujuanQuestionUrl = buildZujuanQuestionUrl;
  global.getPaperQuestionZujuanId = getPaperQuestionZujuanId;
  global.getPaperQuestionZujuanUrl = getPaperQuestionZujuanUrl;
  global.normalizeZujuanQuestionId = normalizeZujuanQuestionId;
  global.openQuestionModal = openQuestionModal;
  global.closeQuestionModal = closeQuestionModal;
  global.getErrorRateClass = getErrorRateClass;
  global.getErrorRateTag = getErrorRateTag;

  global.sortGradesAsc = sortGradesAsc;
  global.sortSubjectsAsc = sortSubjectsAsc;
  global.compareGradeAsc = compareGradeAsc;
  global.compareSubjectAsc = compareSubjectAsc;

  global.filterByPermission = filterByPermission;
  global.getVisibleGrades = getVisibleGrades;
  global.getVisibleClasses = getVisibleClasses;
  global.getVisibleSubjects = getVisibleSubjects;
  global.shouldLockSubject = shouldLockSubject;
  global.getDefaultSubject = getDefaultSubject;

  global.escapeHtml = escapeHtml;
  global.formatDate = formatDate;
  global.formatShortDate = formatShortDate;
  global.onCutoffDateChange = onCutoffDateChange;
  global.onDateRangeApply = onDateRangeApply;
  global.mountPageDateRangeBar = mountPageDateRangeBar;
  global.renderHeader = renderHeader;
  global.renderSidebar = renderSidebar;
  global.checkAuth = checkAuth;
  global.initDashboardLayout = initDashboardLayout;
  global.syncCurrentUserProfile = syncCurrentUserProfile;
  global.getDefaultLandingHref = function () {
    return AppState.getDefaultLandingHref();
  };

  global.sortTable = sortTable;
  global.switchTab = switchTab;
  global.toggleExpand = toggleExpand;
  global.renderPagination = renderPagination;

  /* ==================== 作业标记管理（localStorage） ==================== */
  var HomeworkManager = {
    STORAGE_KEY: 'homeworkMarks',

    getAllMarks: function () {
      try {
        var str = localStorage.getItem(this.STORAGE_KEY);
        if (!str) return [];
        var parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    },

    getSchoolMarks: function () {
      return this.getAllMarks();
    },

    getClassMarks: function (grade, className) {
      var g = grade == null ? '' : String(grade).trim();
      var c = className == null ? '' : String(className).trim();
      return this.getAllMarks().filter(function (m) {
        return m.grade === g && m.class_name === c;
      });
    },

    markHomework: function (grade, className, paperId, paperName, subject, markedBy) {
      var marks = this.getAllMarks();
      var pid = String(paperId);
      var exists = marks.some(function (m) {
        return m.grade === grade && m.class_name === className && String(m.paper_id) === pid;
      });
      if (exists) return;

      marks.push({
        grade: grade,
        class_name: className,
        paper_id: pid,
        paper_name: paperName || '',
        subject: subject || '',
        marked_time: new Date().toISOString().substring(0, 10),
        marked_by: markedBy || '',
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(marks));
    },

    unmarkHomework: function (grade, className, paperId) {
      var marks = this.getAllMarks();
      var pid = String(paperId);
      marks = marks.filter(function (m) {
        return !(m.grade === grade && m.class_name === className && String(m.paper_id) === pid);
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(marks));
    },

    isMarked: function (grade, className, paperId) {
      var pid = String(paperId);
      return this.getAllMarks().some(function (m) {
        return m.grade === grade && m.class_name === className && String(m.paper_id) === pid;
      });
    },

    isHomeworkRecord: function (grade, className, record) {
      if (!record) return false;
      var g = grade == null ? '' : String(grade).trim();
      var c = className == null ? '' : String(className).trim();
      if (!g || !c) return false;
      var pid = String(record.paper_id != null ? record.paper_id : '');
      if (pid && this.isMarked(g, c, pid)) return true;
      var paperName = String(
        record.paper_name || record['试卷名称'] || record['练习名称'] || ''
      ).trim();
      var subject = rowSubject(record);
      if (!paperName) return false;
      return this.getClassMarks(g, c).some(function (m) {
        return (
          String(m.paper_name || '').trim() === paperName &&
          (!m.subject || !subject || m.subject === subject)
        );
      });
    },

    initDemoData: function (examDetail, practiceDetail, students) {
      if (this.getAllMarks().length > 0) return;

      var classGroups = {};
      (students || []).forEach(function (s) {
        var grade = rowGradeVal(s);
        var cls = rowClassName(s);
        var id = rowStudentId(s);
        if (!grade || !cls || !id) return;
        var key = grade + '|' + cls;
        if (!classGroups[key]) {
          classGroups[key] = { grade: grade, class_name: cls, studentIds: [] };
        }
        classGroups[key].studentIds.push(id);
      });

      Object.keys(classGroups).forEach(function (key) {
        var cls = classGroups[key];
        var idSet = cls.studentIds;

        var classExams = (examDetail || []).filter(function (d) {
          return idSet.indexOf(rowStudentId(d)) >= 0;
        });
        var classPractices = (practiceDetail || []).filter(function (d) {
          return idSet.indexOf(rowStudentId(d)) >= 0;
        });

        var examPapers = {};
        classExams.forEach(function (d) {
          var pid = d.paper_id;
          if (pid != null && !examPapers[pid]) examPapers[pid] = d;
        });
        var practicePapers = {};
        classPractices.forEach(function (d) {
          var pid = d.paper_id;
          if (pid != null && !practicePapers[pid]) practicePapers[pid] = d;
        });

        Object.values(examPapers)
          .slice(0, 2)
          .forEach(function (d) {
            HomeworkManager.markHomework(
              cls.grade,
              cls.class_name,
              d.paper_id,
              d.paper_name,
              rowSubject(d),
              'demo'
            );
          });

        Object.values(practicePapers)
          .slice(0, 1)
          .forEach(function (d) {
            HomeworkManager.markHomework(
              cls.grade,
              cls.class_name,
              d.paper_id,
              d.paper_name,
              rowSubject(d),
              'demo'
            );
          });
      });
    },
  };

  global.HomeworkManager = HomeworkManager;
})(typeof window !== 'undefined' ? window : globalThis);
