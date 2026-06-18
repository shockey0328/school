/**
 * 班级管理 diagnosis.html
 * 板块一：核心指标 | 板块二：试卷分析 | 板块三：学情分析
 */

let allStudents = [];
let allDailyActive = [];
let allMaterialDetail = [];
let allVideoDetail = [];
let allExamDetail = [];
let allPracticeDetail = [];
let allKnowledgeMastery = [];

let currentStudents = [];
let currentStudentIds = [];
let currentDailyActive = [];
let currentExamDetail = [];
let currentPracticeDetail = [];
let currentMaterialDetail = [];
let currentVideoDetail = [];
let currentKnowledgeMastery = [];

let dateRangeStart = '';
let dateRangeEnd = '';
let currentMainTab = 0;
let subjectChartInst = null;
var classSsHighFreqExpanded = false;
var classSsTrendInst = null;
var classSsSubjectInst = null;
var classSsWeakBarInst = null;
var classSsWeakCloudInst = null;

window._hwConfirmedPaperIds = [];
window._hwPaperList = [];
window._hwListPage = 1;
var HW_LIST_PAGE_SIZE = 10;

function sid(row) {
  return rowStudentId(row);
}

function sname(row) {
  return rowStudentName(row);
}

function normalizeStudents(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(function (s) {
    return {
      student_id: sid(s),
      student_name: sname(s),
      grade: rowGradeVal(s),
      class_name: rowClassName(s),
      _raw: s,
    };
  });
}

function rateDecimal(rate) {
  if (rate === null || rate === undefined || rate === '') return null;
  var r = Number(rate);
  if (Number.isNaN(r)) return null;
  return r > 1 ? r / 100 : r;
}

function isSubmittedRow(row) {
  return isExamSubmitted(row);
}

/** 同一作业名称在不同学生上可能对应不同 paper_id，按「学科+名称」合并 */
function homeworkGroupKey(d) {
  return (rowSubject(d) || '') + '||' + String(d.paper_name || '').trim();
}

function parseHomeworkGroupKey(key) {
  var s = String(key || '');
  var i = s.indexOf('||');
  if (i < 0) return { subject: '', paperName: s };
  return { subject: s.slice(0, i), paperName: s.slice(i + 2) };
}

function filterRecordsByPaperId(paperId) {
  var pid = String(paperId != null ? paperId : '');
  if (!pid) return [];
  var exam = filterByCurrentSubject(currentExamDetail);
  var practice = filterByCurrentSubject(currentPracticeDetail);
  var records = exam.filter(function (d) {
    return String(d.paper_id) === pid;
  });
  if (!records.length) {
    records = practice.filter(function (d) {
      return String(d.paper_id) === pid;
    });
  }
  return records;
}

function getHomeworkRecords(homeworkKey) {
  if (!homeworkKey) return [];
  var meta = parseHomeworkGroupKey(homeworkKey);
  var all = filterByCurrentSubject(currentExamDetail).concat(
    filterByCurrentSubject(currentPracticeDetail)
  );
  var records = all.filter(function (d) {
    return (
      rowSubject(d) === meta.subject && String(d.paper_name || '').trim() === meta.paperName
    );
  });
  if (!records.length && meta.paperName) {
    records = all.filter(function (d) {
      return String(d.paper_name || '').trim() === meta.paperName;
    });
  }
  return records;
}

/** 优先按学科+名称合并；无结果时按 paper_id（字符串比较）回退 */
function findHomeworkRecords(homeworkKey, paperId) {
  var records = [];
  if (homeworkKey && String(homeworkKey).indexOf('||') >= 0) {
    records = getHomeworkRecords(homeworkKey);
  }
  if (!records.length && paperId) {
    records = filterRecordsByPaperId(paperId);
  }
  if (!records.length && homeworkKey && String(homeworkKey).indexOf('||') < 0) {
    records = filterRecordsByPaperId(homeworkKey);
  }
  return records;
}

function analyzeHomeworkSubmit(records) {
  var latestByStudent = {};
  (records || []).forEach(function (r) {
    var id = sid(r);
    if (!id) return;
    if (!latestByStudent[id] || String(r.submit_time || '') > String(latestByStudent[id].submit_time || '')) {
      latestByStudent[id] = r;
    }
  });

  var submittedRecords = [];
  Object.keys(latestByStudent).forEach(function (id) {
    var row = latestByStudent[id];
    if (isSubmittedRow(row)) submittedRecords.push(row);
  });

  return {
    latestAll: Object.values(latestByStudent),
    submittedRecords: submittedRecords,
  };
}

function getLatestPerStudent(records) {
  var map = {};
  (records || []).forEach(function (r) {
    var id = sid(r);
    if (!id) return;
    if (!map[id] || String(r.submit_time || '') > String(map[id].submit_time || '')) {
      map[id] = r;
    }
  });
  return Object.values(map);
}

/** 统计有作答记录的学生人数（参与率分子，与「作答人数」口径一致） */
function countHwParticipants(records) {
  var set = new Set();
  (records || []).forEach(function (r) {
    var id = sid(r);
    if (id) set.add(id);
  });
  return set.size;
}

function sortClassNames(list) {
  return list.slice().sort(function (a, b) {
    var na = parseInt(String(a).replace(/\D/g, ''), 10);
    var nb = parseInt(String(b).replace(/\D/g, ''), 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return String(a).localeCompare(String(b), 'zh-CN');
  });
}

function getFrontlineClassOptions(grade) {
  var visible = sortClassNames(AppState.getAllVisibleClasses());
  if (!visible.length) return [];
  var fromData = getVisibleClasses(
    allStudents.map(function (s) {
      return s._raw || s;
    }),
    grade
  );
  var filtered = fromData.filter(function (c) {
    return visible.indexOf(c) !== -1;
  });
  return sortClassNames(filtered.length ? filtered : visible);
}

function disposeChartDom(domId) {
  var dom = document.getElementById(domId);
  if (!dom || typeof echarts === 'undefined') return;
  var inst = echarts.getInstanceByDom(dom);
  if (inst) inst.dispose();
}

function disposeSelfStudyCharts() {
  disposeChartDom('ssTrendChart');
  disposeChartDom('ssSubjectChart');
  disposeChartDom('ssWeakKnowledgeChart');
  disposeChartDom('ssWeakKnowledgeCloud');
  subjectChartInst = null;
  classSsTrendInst = null;
  classSsSubjectInst = null;
  classSsWeakBarInst = null;
  classSsWeakCloudInst = null;
}

function disposeSubjectChart() {
  disposeSelfStudyCharts();
}

function bindSelfStudyResize() {
  if (window._ssResizeBound) return;
  window._ssResizeBound = true;
  window.addEventListener('resize', function () {
    if (currentMainTab !== 0) return;
    resizeSelfStudyCharts();
  });
}

function resizeSelfStudyCharts() {
  ['ssTrendChart', 'ssSubjectChart', 'ssWeakKnowledgeChart', 'ssWeakKnowledgeCloud'].forEach(
    function (id) {
      var dom = document.getElementById(id);
      if (!dom || typeof echarts === 'undefined') return;
      var inst = echarts.getInstanceByDom(dom);
      if (inst) inst.resize();
    }
  );
}

function isSelfStudyPanelVisible() {
  var panel = document.getElementById('selfStudyPanel');
  if (!panel || panel.hidden) return false;
  return panel.classList.contains('active');
}

/** 面板 display:none 时 ECharts 会得到 0 尺寸，需等容器可见后再 init */
function whenChartContainerReady(dom, callback) {
  if (!dom) return;
  var attempts = 0;
  function tick() {
    if (dom.offsetWidth > 0 && dom.offsetHeight > 0) {
      callback();
      return;
    }
    attempts += 1;
    if (attempts < 48) {
      requestAnimationFrame(tick);
    } else {
      callback();
    }
  }
  tick();
}

function scheduleSelfStudyChartResize() {
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      resizeSelfStudyCharts();
    });
  });
}

function initEchartInstance(dom, onReady) {
  whenChartContainerReady(dom, function () {
    if (!dom || typeof echarts === 'undefined') return;
    var prev = echarts.getInstanceByDom(dom);
    if (prev) prev.dispose();
    onReady(echarts.init(dom));
  });
}

/* ==================== 初始化 ==================== */

async function init() {
  try {
    if (typeof ensureSchoolBrands === 'function') {
      await ensureSchoolBrands();
    }
    if (!initDashboardLayout('diagnosis')) return;

    if (typeof syncCurrentUserProfile === 'function') {
      await syncCurrentUserProfile();
      initDashboardLayout('diagnosis');
    }

    var range = AppState.getDateRange();
    dateRangeStart = range.start;
    dateRangeEnd = range.end;

    var loaded = await Promise.all([
      DataLoader.students(),
      DataLoader.dailyActive(),
      DataLoader.materialDetail(),
      DataLoader.videoDetail(),
      DataLoader.examDetail(),
      DataLoader.practiceDetail(),
      DataLoader.knowledgeMastery(),
      DataLoader.paperQuestions(),
    ]);

    if (typeof setPaperQuestionMap === 'function') {
      setPaperQuestionMap(loaded[7] || []);
    }

    var school = AppState.getSchool();
    allStudents = normalizeStudents(filterBySchool(loaded[0], school));
    var schoolIds = allStudents.map(function (s) {
      return s.student_id;
    });
    var idSet = new Set(schoolIds);

    allDailyActive = normalizeDailyActiveRows(loaded[1] || []).filter(function (d) {
      return idSet.has(rowDailyActiveUserId(d));
    });

    function schoolFilter(arr, timeField) {
      return filterByDateRange(
        (arr || []).filter(function (d) {
          return idSet.has(sid(d));
        }),
        dateRangeStart,
        dateRangeEnd,
        timeField
      );
    }

    allMaterialDetail = applyTenantToRows(schoolFilter(loaded[2], 'dt'), school);
    allVideoDetail = applyTenantToRows(schoolFilter(loaded[3], 'dt'), school);
    allExamDetail = applyTenantToRows(schoolFilter(loaded[4], 'submit_time'), school);
    allPracticeDetail = applyTenantToRows(schoolFilter(loaded[5], 'submit_time'), school);
    allKnowledgeMastery = applyTenantToRows(schoolFilter(loaded[6], 'judge_time'), school);

    if (typeof HomeworkManager !== 'undefined') {
      HomeworkManager.initDemoData(allExamDetail, allPracticeDetail, allStudents);
    }

    initFilters();
  } catch (e) {
    console.error('班级管理初始化失败:', e);
    var main = document.querySelector('.main-content--board');
    if (main) {
      main.insertAdjacentHTML(
        'afterbegin',
        '<div class="card" style="margin:16px;border-color:#fecaca;background:#fef2f2;color:#991b1b">' +
          '<p style="margin:0 0 8px;font-weight:600">页面加载失败</p>' +
          '<p style="margin:0;font-size:13px">请通过 <code>start-local.bat</code> 启动本地服务后访问 ' +
          '<code>http://127.0.0.1:8080/diagnosis.html</code>，并确认已登录。若仍失败，请按 F12 查看控制台报错。</p>' +
          '</div>'
      );
    }
  }
}

window.addEventListener('DOMContentLoaded', init);

/* ==================== 筛选器 ==================== */

function initFilters() {
  var gradeSelect = document.getElementById('gradeSelect');
  var grades = getVisibleGrades(
    allStudents.map(function (s) {
      return s._raw || s;
    })
  );

  if (AppState.isFrontline()) {
    var grade = AppState.getGrade();
    gradeSelect.innerHTML = '<option value="' + escapeHtml(grade) + '">' + escapeHtml(grade) + '</option>';
    gradeSelect.disabled = true;
  } else {
    gradeSelect.innerHTML = grades
      .map(function (g) {
        return '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + '</option>';
      })
      .join('');
  }
  onGradeChange();
  applyQueryFromUrl();
}

function applyQueryFromUrl() {
  var params = new URLSearchParams(window.location.search);
  var qGrade = params.get('grade');
  var qClass = params.get('class');
  if (!qGrade && !qClass) return;

  var gradeSelect = document.getElementById('gradeSelect');
  var classSelect = document.getElementById('classSelect');
  if (!gradeSelect || !classSelect) return;

  if (qGrade) {
    var grades = Array.prototype.map.call(gradeSelect.options, function (o) {
      return o.value;
    });
    if (grades.indexOf(qGrade) >= 0) gradeSelect.value = qGrade;
  }
  onGradeChange();

  if (!qClass) return;
  var classes = Array.prototype.map.call(classSelect.options, function (o) {
    return o.value;
  });
  var classVal = qClass;
  if (classes.indexOf(classVal) < 0 && classVal.indexOf('-') >= 0) {
    var parts = classVal.split('-');
    if (parts.length >= 2) classVal = parts.slice(1).join('-');
  }
  if (classes.indexOf(classVal) >= 0) {
    classSelect.value = classVal;
    onClassChange();
  }
}

function onGradeChange() {
  var grade = document.getElementById('gradeSelect').value;
  var classSelect = document.getElementById('classSelect');

  if (AppState.isFrontline()) {
    var filtered = getFrontlineClassOptions(grade);
    var visibleAll = sortClassNames(AppState.getAllVisibleClasses());
    if (filtered.length < visibleAll.length && visibleAll.length) filtered = visibleAll;
    classSelect.innerHTML = filtered
      .map(function (c) {
        return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
      })
      .join('');
    classSelect.disabled = visibleAll.length <= 1;
  } else {
    var classes = getVisibleClasses(
      allStudents.map(function (s) {
        return s._raw || s;
      }),
      grade
    );
    classSelect.innerHTML = classes
      .map(function (c) {
        return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
      })
      .join('');
    classSelect.disabled = false;
  }
  onClassChange();
}

function onClassChange() {
  var grade = document.getElementById('gradeSelect').value;
  var className = document.getElementById('classSelect').value;

  currentStudents = allStudents.filter(function (s) {
    return s.grade === grade && s.class_name === className;
  });
  currentStudentIds = currentStudents.map(function (s) {
    return s.student_id;
  });
  var idSet = new Set(currentStudentIds);

  currentDailyActive = allDailyActive.filter(function (d) {
    return idSet.has(rowDailyActiveUserId(d));
  });
  currentExamDetail = allExamDetail.filter(function (d) {
    return idSet.has(sid(d));
  });
  currentPracticeDetail = allPracticeDetail.filter(function (d) {
    return idSet.has(sid(d));
  });
  currentMaterialDetail = allMaterialDetail.filter(function (d) {
    return idSet.has(sid(d));
  });
  currentVideoDetail = allVideoDetail.filter(function (d) {
    return idSet.has(sid(d));
  });
  currentKnowledgeMastery = allKnowledgeMastery.filter(function (d) {
    return idSet.has(sid(d));
  });

  resetHomeworkPanelState();
  classSsHighFreqExpanded = false;
  updateSubjectFilter(className);
  renderAll();
}

function updateSubjectFilter(className) {
  var subjectSelect = document.getElementById('subjectSelect');
  var allSubjects = typeof sortSubjectsAsc === 'function'
    ? sortSubjectsAsc(
        getUniqueValues(
          currentExamDetail.concat(currentPracticeDetail, currentMaterialDetail, currentVideoDetail),
          'subject'
        )
      )
    : getUniqueValues(
        currentExamDetail.concat(currentPracticeDetail, currentMaterialDetail, currentVideoDetail),
        'subject'
      );

  if (shouldLockSubject(className)) {
    var mySubject = AppState.getSubject();
    subjectSelect.innerHTML =
      '<option value="' + escapeHtml(mySubject) + '">' + escapeHtml(mySubject) + '</option>';
    subjectSelect.disabled = true;
  } else {
    subjectSelect.innerHTML =
      '<option value="">全部学科</option>' +
      allSubjects
        .map(function (s) {
          return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>';
        })
        .join('');
    subjectSelect.disabled = false;
  }
}

function onSubjectChange() {
  classSsHighFreqExpanded = false;
  window._hwListPage = 1;
  renderAll();
}

function getCurrentSubject() {
  return document.getElementById('subjectSelect').value;
}

function filterByCurrentSubject(arr) {
  var subject = getCurrentSubject();
  return subject ? filterBySubject(arr, subject) : arr;
}

function renderAll() {
  renderCoreMetrics();
  renderPaperAnalysis();
  if (isSelfStudyPanelVisible()) {
    renderClassLearningAnalysis();
  }
}

/* ==================== Tab ==================== */

function switchMainTab(index) {
  currentMainTab = index;
  document.querySelectorAll('#mainTabs .tab').forEach(function (t, i) {
    t.classList.toggle('active', i === index);
  });
  var hwPanel = document.getElementById('homeworkPanel');
  var ssPanel = document.getElementById('selfStudyPanel');
  if (hwPanel) {
    hwPanel.classList.toggle('active', index === 1);
    hwPanel.hidden = index !== 1;
  }
  if (ssPanel) {
    ssPanel.classList.toggle('active', index === 0);
    ssPanel.hidden = index !== 0;
  }
  if (index === 0) {
    requestAnimationFrame(function () {
      renderClassLearningAnalysis();
    });
  }
}

/* ==================== 板块一：核心指标 ==================== */

function renderCoreMetrics() {
  var el = document.getElementById('coreMetrics');
  if (!el) return;

  var totalStudents = currentStudents.length;
  var records = filterByCurrentSubject(
    currentMaterialDetail.concat(currentVideoDetail, currentExamDetail, currentPracticeDetail)
  );

  if (!totalStudents) {
    el.innerHTML =
      '<div class="metric-card metric-card--stat" style="grid-column:1/-1;text-align:center;">' +
      '<div class="metric-label">' +
      escapeHtml('当前班级暂无学生数据，请调整筛选条件。') +
      '</div></div>';
    return;
  }

  var participantIds = new Set();
  records.forEach(function (d) {
    participantIds.add(sid(d));
  });
  var participantCount = participantIds.size;
  var participantRate =
    totalStudents > 0 ? ((participantCount / totalStudents) * 100).toFixed(1) : '0.0';
  var totalActions = records.length;

  el.innerHTML =
    renderMetricCardHtml(escapeHtml(formatNumber(totalStudents)), '班级人数') +
    renderMetricCardHtml(escapeHtml(formatNumber(participantCount)), '学习参与人数') +
    renderMetricCardHtml(escapeHtml(participantRate) + '%', '学习参与率') +
    renderMetricCardHtml(escapeHtml(formatNumber(totalActions)), '累计学习次数');
}

/* ==================== 板块二：试卷分析 ==================== */

function buildPaperListFromRecords() {
  var allData = filterByCurrentSubject(currentExamDetail.concat(currentPracticeDetail));
  var paperMap = {};

  allData.forEach(function (d) {
    var pid = String(d.paper_id != null ? d.paper_id : '');
    if (!pid) return;
    if (!paperMap[pid]) {
      paperMap[pid] = {
        paper_id: pid,
        paper_name: d.paper_name,
        subject: rowSubject(d),
        scene: d.scene || '刷真题',
        submit_time: d.submit_time || '',
        studentIds: new Set(),
        records: [],
      };
    }
    paperMap[pid].studentIds.add(sid(d));
    paperMap[pid].records.push(d);
    if (String(d.submit_time || '') > String(paperMap[pid].submit_time)) {
      paperMap[pid].submit_time = d.submit_time;
    }
  });

  return Object.keys(paperMap)
    .map(function (k) {
      var p = paperMap[k];
      var latest = getLatestPerStudent(p.records);
      var avgDec = calcCorrectRate(latest);
      var correctRate =
        avgDec !== null && avgDec !== undefined ? Math.round(avgDec * 100) : null;
      return {
        paper_id: p.paper_id,
        paper_name: p.paper_name,
        subject: p.subject,
        scene: p.scene,
        submit_time: p.submit_time,
        studentCount: p.studentIds.size,
        correctRate: correctRate,
      };
    })
    .sort(function (a, b) {
      return new Date(b.submit_time || 0) - new Date(a.submit_time || 0);
    });
}

function resetHomeworkPanelState() {
  window._hwConfirmedPaperIds = [];
  window._hwPaperList = [];
  window._hwListPage = 1;
  window._hwActivePaperId = '';
  var detail = document.getElementById('paperDetailPanel');
  var listZone = document.querySelector('.hw-paper-list');
  if (detail) detail.hidden = true;
  if (listZone) listZone.hidden = false;
}

function getHwRecordsByPaperId(paperId) {
  var pid = String(paperId);
  var exam = filterByCurrentSubject(currentExamDetail).filter(function (d) {
    return String(d.paper_id) === pid;
  });
  var practice = filterByCurrentSubject(currentPracticeDetail).filter(function (d) {
    return String(d.paper_id) === pid;
  });
  return exam.concat(practice);
}

function renderPaperAnalysis() {
  var papers = buildPaperListFromRecords();
  window._hwPaperList = papers;
  window._hwConfirmedPaperIds = papers.map(function (p) {
    return String(p.paper_id);
  });

  renderPaperListPage();

  var placeholder = document.getElementById('homeworkPlaceholder');
  if (placeholder) placeholder.hidden = papers.length > 0;
}

function hwSceneTagClass(scene) {
  var s = String(scene || '');
  if (s.indexOf('刷真题') >= 0) return 'tag-scene tag-scene--other';
  if (s.indexOf('真题') >= 0 || s.indexOf('卷') >= 0) return 'tag-scene tag-scene--exam';
  if (s.indexOf('练习') >= 0 || s.indexOf('在线练') >= 0) return 'tag-scene tag-scene--practice';
  if (s.indexOf('视频') >= 0) return 'tag-scene tag-scene--video';
  return 'tag-scene tag-scene--other';
}

function renderHwParticipationCell(studentCount, totalStudents) {
  var total = totalStudents || 0;
  var count = studentCount || 0;
  var pct = total > 0 ? Math.round((count / total) * 100) : 0;
  var fillClass = pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'low';
  return (
    '<div class="hw-progress" title="参与率 ' +
    pct +
    '%"><span class="hw-progress__fill hw-progress__fill--' +
    fillClass +
    '" style="width:' +
    pct +
    '%"></span></div>' +
    '<span class="hw-progress__text">' +
    count +
    '/' +
    total +
    ' · ' +
    pct +
    '%</span>'
  );
}

function renderHwCorrectRateCell(correctRatePct) {
  if (correctRatePct == null || !Number.isFinite(correctRatePct)) {
    return '<span style="color:var(--text-light);">--</span>';
  }
  var rateClass =
    correctRatePct >= 80 ? 'tag-success' : correctRatePct >= 60 ? 'tag-warning' : 'tag-error';
  return '<span class="tag ' + rateClass + '">' + correctRatePct + '%</span>';
}

function renderPaperListPage() {
  var papers = window._hwPaperList || [];
  var container = document.getElementById('homeworkCheckList');
  var pagerEl = document.getElementById('homeworkCheckPager');
  if (!container) return;

  var totalStudents = currentStudents.length;

  if (!papers.length) {
    container.innerHTML =
      '<div style="text-align:center;padding:40px 24px;color:var(--text-light);">暂无试卷数据</div>';
    if (pagerEl) pagerEl.hidden = true;
    var emptyHint = document.getElementById('hwListHint');
    if (emptyHint) emptyHint.hidden = true;
    return;
  }

  var totalPages = Math.max(1, Math.ceil(papers.length / HW_LIST_PAGE_SIZE));
  var page = window._hwListPage || 1;
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  window._hwListPage = page;

  var start = (page - 1) * HW_LIST_PAGE_SIZE;
  var pagePapers = papers.slice(start, start + HW_LIST_PAGE_SIZE);

  var listHint = document.getElementById('hwListHint');
  if (listHint) {
    if (papers.length > 0) {
      listHint.hidden = false;
      listHint.textContent = '共 ' + papers.length + ' 份试卷，每页 ' + HW_LIST_PAGE_SIZE + ' 份';
    } else {
      listHint.hidden = true;
      listHint.textContent = '';
    }
  }

  var html =
    '<table class="hw-table"><colgroup>' +
    '<col class="hw-table__col-name" />' +
    '<col class="hw-table__col-subject" /><col class="hw-table__col-scene" /><col class="hw-table__col-participate" />' +
    '<col class="hw-table__col-rate" /><col class="hw-table__col-action" /></colgroup><thead><tr>' +
    '<th class="hw-table__col-name">试卷名称</th>' +
    '<th class="hw-table__col-subject">学科</th>' +
    '<th class="hw-table__col-scene">模块</th>' +
    '<th class="hw-table__col-participate">参与率</th>' +
    '<th class="hw-table__col-rate">正确率</th>' +
    '<th class="hw-table__col-action">操作</th>' +
    '</tr></thead><tbody>';

  pagePapers.forEach(function (p) {
    var pct = totalStudents > 0 ? Math.round((p.studentCount / totalStudents) * 100) : 0;
    var rowClass = 'hw-table__row';

    html +=
      '<tr class="' +
      rowClass +
      '"><td class="hw-table__col-name"><span class="hw-table__name" title="' +
      escapeHtml(p.paper_name) +
      '">' +
      escapeHtml(p.paper_name) +
      '</span></td><td class="hw-table__col-subject">' +
      escapeHtml(p.subject || '--') +
      '</td><td class="hw-table__col-scene"><span class="' +
      hwSceneTagClass(p.scene) +
      '">' +
      escapeHtml(typeof formatSceneLabel === 'function' ? formatSceneLabel(p.scene) : p.scene || '--') +
      '</span></td><td class="hw-table__col-participate">' +
      renderHwParticipationCell(p.studentCount, totalStudents) +
      '</td><td class="hw-table__col-rate">' +
      renderHwCorrectRateCell(p.correctRate) +
      '</td><td class="hw-table__col-action">' +
      '<button type="button" class="btn-text btn-view-paper" data-paper-id="' +
      escapeHtml(String(p.paper_id)) +
      '">查看</button></td></tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
  bindPaperListViewEvents(container);
  renderHomeworkListPager(page, totalPages, papers.length, start, pagePapers.length);
}

function bindPaperListViewEvents(container) {
  if (!container || container._paperViewBound) return;
  container._paperViewBound = true;
  container.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.btn-view-paper');
    if (!btn) return;
    var paperId = btn.getAttribute('data-paper-id');
    if (paperId) openPaperDetail(paperId);
  });
}

function buildPaperQuestionStats(records) {
  if (!records.length) return null;

  var paperId = String(records[0].paper_id != null ? records[0].paper_id : '');
  window._hwPaperMeta = window._hwPaperMeta || {};
  window._hwPaperMeta[paperId] = {
    paper_id: paperId,
    paper_name: records[0].paper_name || '',
    subject: rowSubject(records[0]),
    chapter: records[0].chapter || records[0]['章节'] || '',
    knowledge_point: records[0].knowledge_point || records[0]['知识点'] || '',
  };

  var totalQ = 0;
  records.forEach(function (d) {
    var tq = parseInt(d.total_questions, 10);
    if (Number.isFinite(tq) && tq > totalQ) totalQ = tq;
  });
  if (!totalQ) return null;

  var doerCount = records.length;
  var questionData = [];
  for (var i = 1; i <= totalQ; i++) {
    var wrongCount = 0;
    var wrongStudents = [];
    records.forEach(function (d) {
      if (recordHasWrongQuestionNo(paperId, d.wrong_question_ids, i)) {
        wrongCount += 1;
        var st = currentStudents.find(function (s) {
          return s.student_id === sid(d);
        });
        if (st) wrongStudents.push(st.student_name);
      }
    });
    var correctRate =
      doerCount > 0 ? parseFloat((((doerCount - wrongCount) / doerCount) * 100).toFixed(1)) : 100;
    questionData.push({
      num: i,
      correctRate: correctRate,
      wrongCount: wrongCount,
      wrongStudents: wrongStudents,
      zujuanUrl:
        typeof getPaperQuestionZujuanUrl === 'function'
          ? getPaperQuestionZujuanUrl(paperId, i)
          : 'https://zujuan.xkw.com/11q33474302.html',
    });
  }

  var submittedSet = new Set(records.map(sid));
  var notSubmitted = currentStudents.filter(function (s) {
    return !submittedSet.has(s.student_id);
  });

  return {
    paperId: paperId,
    paperMeta: window._hwPaperMeta[paperId],
    totalQ: totalQ,
    doerCount: doerCount,
    questionData: questionData,
    notSubmitted: notSubmitted,
  };
}

function collectPaperWeakKnowledge(paperId, limit) {
  var kpData = currentKnowledgeMastery.filter(function (d) {
    return String(d.paper_id) === String(paperId);
  });
  if (!kpData.length) return [];

  var latestMap = {};
  kpData.forEach(function (d) {
    var key = sid(d) + '|' + (d.knowledge_point || '');
    if (!latestMap[key] || String(d.judge_time) > String(latestMap[key].judge_time)) {
      latestMap[key] = d;
    }
  });

  var kpStats = {};
  Object.keys(latestMap).forEach(function (k) {
    var d = latestMap[k];
    var kp = d.knowledge_point || '未知';
    if (!kpStats[kp]) kpStats[kp] = { name: kp, notMastered: 0 };
    if (String(d.is_mastered || '').trim() === '未掌握') kpStats[kp].notMastered += 1;
  });

  return Object.keys(kpStats)
    .map(function (k) {
      return kpStats[k];
    })
    .filter(function (k) {
      return k.notMastered > 0;
    })
    .sort(function (a, b) {
      return b.notMastered - a.notMastered;
    })
    .slice(0, typeof limit === 'number' ? limit : 10);
}

function buildHighFreqErrorsTableHtml(display) {
  if (!display || !display.length) {
    return '<div class="high-freq-errors-empty">暂无高频错题数据</div>';
  }

  var html =
    '<table class="data-table high-freq-errors-table">' +
    '<colgroup>' +
    '<col class="hf-col-rank" />' +
    '<col class="hf-col-paper" />' +
    '<col class="hf-col-question" />' +
    '<col class="hf-col-subject" />' +
    '<col class="hf-col-wrong" />' +
    '<col class="hf-col-rate" />' +
    '</colgroup>' +
    '<thead><tr>' +
    '<th scope="col">排名</th>' +
    '<th scope="col">来源试卷</th>' +
    '<th scope="col">题目</th>' +
    '<th scope="col">学科</th>' +
    '<th scope="col">做错人次</th>' +
    '<th scope="col">正确率</th>' +
    '</tr></thead><tbody>';

  display.forEach(function (item, idx) {
    var rateClass =
      item.correctRate >= 80 ? 'tag-success' : item.correctRate >= 60 ? 'tag-warning' : 'tag-error';
    var paperName = item.paperName || '--';
    html +=
      '<tr>' +
      '<td class="hf-cell-rank">' +
      (idx + 1) +
      '</td>' +
      '<td class="hf-cell-paper" title="' +
      escapeAttrClass(paperName) +
      '">' +
      escapeHtml(paperName) +
      '</td>' +
      '<td class="hf-cell-question"><a class="hf-question-link" href="' +
      escapeAttrClass(item.zujuanUrl) +
      '" target="_blank" rel="noopener noreferrer">查看原题</a></td>' +
      '<td class="hf-cell-subject">' +
      escapeHtml(item.subject || '--') +
      '</td>' +
      '<td class="hf-cell-wrong">' +
      item.wrongCount +
      ' 人</td>' +
      '<td class="hf-cell-rate"><span class="tag ' +
      rateClass +
      '">' +
      item.correctRate +
      '%</span></td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function renderPaperHighFreqErrorsTableHtml(paperId, questionData, meta, options) {
  var opts = options || {};
  var paperName = (meta && meta.paper_name) || '--';
  var subject = (meta && meta.subject) || '--';
  var rows = (questionData || [])
    .filter(function (q) {
      return q.wrongCount > 0;
    })
    .sort(function (a, b) {
      return b.wrongCount - a.wrongCount || a.correctRate - b.correctRate;
    });

  if (typeof opts.limit === 'number') {
    rows = rows.slice(0, opts.limit);
  }

  if (!rows.length) {
    return (
      '<div class="analysis-table-wrap"><div class="high-freq-errors-empty">' +
      escapeHtml(opts.emptyText || '暂无错题，全部正确') +
      '</div></div>'
    );
  }

  var display = rows.map(function (q) {
    return {
      paperName: paperName,
      subject: subject,
      wrongCount: q.wrongCount,
      correctRate: q.correctRate,
      zujuanUrl:
        q.zujuanUrl ||
        (typeof getPaperQuestionZujuanUrl === 'function'
          ? getPaperQuestionZujuanUrl(paperId, q.num)
          : 'https://zujuan.xkw.com/11q33474302.html'),
    };
  });

  return '<div class="analysis-table-wrap">' + buildHighFreqErrorsTableHtml(display) + '</div>';
}

function renderPaperQuestionTableHtml(paperId, questionData, options) {
  var opts = options || {};
  var rows = questionData.slice();
  if (opts.onlyWrong) {
    rows = rows.filter(function (q) {
      return q.wrongCount > 0;
    });
  }
  if (opts.sortByNum) {
    rows.sort(function (a, b) {
      return a.num - b.num;
    });
  } else {
    rows.sort(function (a, b) {
      return b.wrongCount - a.wrongCount || a.correctRate - b.correctRate;
    });
  }
  if (typeof opts.limit === 'number') {
    rows = rows.slice(0, opts.limit);
  }

  if (!rows.length) {
    return '<div class="paper-detail__empty">' + escapeHtml(opts.emptyText || '暂无数据') + '</div>';
  }

  var html =
    '<table class="data-table" style="font-size:13px;"><thead><tr><th>序号</th><th>正确率</th><th>做错人数</th><th>做错学生</th><th>操作</th></tr></thead><tbody>';
  rows.forEach(function (q) {
    var tagClass =
      q.correctRate >= 80 ? 'tag-success' : q.correctRate >= 60 ? 'tag-warning' : 'tag-error';
    html +=
      '<tr><td>' +
      q.num +
      '</td><td><span class="tag ' +
      tagClass +
      '">' +
      q.correctRate +
      '%</span></td><td style="color:var(--error);">' +
      q.wrongCount +
      '人</td><td style="font-size:12px;">' +
      escapeHtml(q.wrongStudents.join('、') || '--') +
      '</td><td>' +
      (q.wrongCount > 0
        ? '<a class="btn-text" href="' +
          escapeAttrClass(q.zujuanUrl || 'https://zujuan.xkw.com/11q33474302.html') +
          '" target="_blank" rel="noopener noreferrer">查看原题</a>'
        : '--') +
      '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

function renderPaperDetailPage(paperId) {
  var pid = String(paperId || '');
  var records = getLatestPerStudent(getHwRecordsByPaperId(pid));
  var titleEl = document.getElementById('paperDetailTitle');
  var metaEl = document.getElementById('paperDetailMeta');
  var bodyEl = document.getElementById('paperDetailBody');

  if (!bodyEl) return;

  if (!records.length) {
    if (titleEl) titleEl.textContent = '试卷详情';
    if (metaEl) metaEl.textContent = '';
    bodyEl.innerHTML = '<div class="paper-detail__empty">暂无该试卷数据</div>';
    return;
  }

  var paperName = records[0].paper_name || '未知试卷';
  var subject = rowSubject(records[0]) || '--';
  var scene = records[0].scene || '--';
  var totalStudents = currentStudents.length;
  var participantCount = countHwParticipants(records);
  var participateRate =
    totalStudents > 0 ? calcPercent(participantCount, totalStudents) : 0;
  var avgDec = calcCorrectRate(records);
  var avgText = avgDec !== null ? formatPercent(avgDec) : '--';
  var stats = buildPaperQuestionStats(records);
  var totalErrors = stats
    ? stats.questionData.filter(function (q) {
        return q.wrongCount > 0;
      }).length
    : 0;

  if (titleEl) titleEl.textContent = paperName;
  if (metaEl) {
    metaEl.textContent =
      subject +
      ' · ' +
      (typeof formatSceneLabel === 'function' ? formatSceneLabel(scene) : scene) +
      ' · 参与 ' +
      participantCount +
      '/' +
      totalStudents +
      ' 人';
  }

  var weakList = collectPaperWeakKnowledge(pid, 10);
  var html = '';

  html += '<section><h4 class="paper-detail__section-title">整体答题情况</h4>';
  html += '<div class="paper-detail__overview">';
  html +=
    '<div class="paper-detail__stat"><div class="paper-detail__stat-label">参与率</div><div class="paper-detail__stat-value">' +
    participateRate +
    '%</div></div>';
  html +=
    '<div class="paper-detail__stat"><div class="paper-detail__stat-label">平均正确率</div><div class="paper-detail__stat-value" style="color:' +
    getRateColor(avgDec) +
    ';">' +
    avgText +
    '</div></div>';
  html +=
    '<div class="paper-detail__stat"><div class="paper-detail__stat-label">累计错题</div><div class="paper-detail__stat-value" style="color:var(--error);">' +
    totalErrors +
    ' 题</div></div>';
  html +=
    '<div class="paper-detail__stat"><div class="paper-detail__stat-label">作答人数</div><div class="paper-detail__stat-value">' +
    participantCount +
    ' 人</div></div>';
  html += '</div>';
  if (stats && stats.notSubmitted.length) {
    html +=
      '<div class="paper-detail__alert" style="margin-top:12px;"><strong>未提交（' +
      stats.notSubmitted.length +
      '人）：</strong>' +
      escapeHtml(stats.notSubmitted.map(function (s) { return s.student_name; }).join('、')) +
      '</div>';
  }
  html += '</section>';

  if (stats) {
    html += '<section><h4 class="paper-detail__section-title">作答详情</h4>';
    html += renderPaperQuestionTableHtml(pid, stats.questionData, {
      sortByNum: true,
      emptyText: '暂无题目数据',
    });
    html += '</section>';

    html += '<section><h4 class="paper-detail__section-title">高频错题 TOP10</h4>';
    html += renderPaperHighFreqErrorsTableHtml(pid, stats.questionData, stats.paperMeta, {
      limit: 10,
      emptyText: '暂无错题，全部正确',
    });
    html += '</section>';
  }

  html += '<section><h4 class="paper-detail__section-title">高频薄弱点 TOP10</h4>';
  if (weakList.length) {
    html +=
      '<table class="data-table" style="font-size:13px;"><thead><tr><th>排名</th><th>知识点</th><th>未掌握人数</th></tr></thead><tbody>';
    weakList.forEach(function (k, idx) {
      html +=
        '<tr><td>' +
        (idx + 1) +
        '</td><td style="font-weight:500;">' +
        escapeHtml(k.name) +
        '</td><td style="font-weight:600;color:var(--error);">' +
        k.notMastered +
        ' 人</td></tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<div class="paper-detail__empty">暂无薄弱知识点数据</div>';
  }
  html += '</section>';

  bodyEl.innerHTML = html;
}

function openPaperDetail(paperId) {
  var listZone = document.querySelector('.hw-paper-list');
  var placeholder = document.getElementById('homeworkPlaceholder');
  var detail = document.getElementById('paperDetailPanel');
  window._hwActivePaperId = String(paperId || '');

  if (listZone) listZone.hidden = true;
  if (placeholder) placeholder.hidden = true;
  if (detail) {
    detail.hidden = false;
    renderPaperDetailPage(paperId);
    if (detail.scrollIntoView) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function closePaperDetail() {
  window._hwActivePaperId = '';
  var listZone = document.querySelector('.hw-paper-list');
  var placeholder = document.getElementById('homeworkPlaceholder');
  var detail = document.getElementById('paperDetailPanel');
  var papers = window._hwPaperList || [];

  if (detail) detail.hidden = true;
  if (listZone) listZone.hidden = false;
  if (placeholder) placeholder.hidden = papers.length > 0;
}

function renderHomeworkListPager(page, totalPages, totalCount, startIndex, pageCount) {
  var pagerEl = document.getElementById('homeworkCheckPager');
  if (!pagerEl) return;

  if (totalCount <= HW_LIST_PAGE_SIZE) {
    pagerEl.hidden = true;
    pagerEl.innerHTML = '';
    return;
  }

  pagerEl.hidden = false;
  var endIndex = startIndex + pageCount;
  pagerEl.innerHTML =
    '<span class="hw-paper-list__pager-info">第 ' +
    (startIndex + 1) +
    '–' +
    endIndex +
    ' 份，共 ' +
    totalCount +
    ' 份</span>' +
    '<div class="hw-paper-list__pager-btns">' +
    '<button type="button" class="btn btn-outline btn-sm"' +
    (page <= 1 ? ' disabled' : '') +
    ' onclick="changeHomeworkListPage(' +
    (page - 1) +
    ')">上一页</button>' +
    '<span class="hw-paper-list__pager-page">' +
    page +
    ' / ' +
    totalPages +
    '</span>' +
    '<button type="button" class="btn btn-outline btn-sm"' +
    (page >= totalPages ? ' disabled' : '') +
    ' onclick="changeHomeworkListPage(' +
    (page + 1) +
    ')">下一页</button>' +
    '</div>';
}

function changeHomeworkListPage(page) {
  var totalPages = Math.max(1, Math.ceil((window._hwPaperList || []).length / HW_LIST_PAGE_SIZE));
  var next = parseInt(page, 10);
  if (!Number.isFinite(next) || next < 1 || next > totalPages) return;
  window._hwListPage = next;
  renderPaperListPage();
}

function hwPeriodLabel() {
  return '全部时段';
}

function viewHwQuestion(paperId, questionNo) {
  var url =
    typeof getPaperQuestionZujuanUrl === 'function'
      ? getPaperQuestionZujuanUrl(paperId, questionNo)
      : 'https://zujuan.xkw.com/11q33474302.html';
  window.open(url, '_blank', 'noopener,noreferrer');
}

function renderResourceDetailContent(records) {
  var stats = buildPaperQuestionStats(records);
  if (!stats) return '<div style="color:var(--text-light);">暂无题目数据</div>';

  var html = '';
  if (stats.notSubmitted.length) {
    html +=
      '<div style="margin-bottom:12px;padding:8px 12px;background:#FEF2F2;border-radius:6px;font-size:13px;">' +
      '<span style="color:var(--error);font-weight:600;">未提交（' +
      stats.notSubmitted.length +
      '人）：</span><span style="color:var(--error);">' +
      escapeHtml(stats.notSubmitted.map(function (s) { return s.student_name; }).join('、')) +
      '</span></div>';
  }

  html += renderPaperHighFreqErrorsTableHtml(stats.paperId, stats.questionData, stats.paperMeta, {
    emptyText: '全部正确',
  });
  if (!stats.questionData.some(function (q) { return q.wrongCount > 0; })) {
    html += '<p class="msg-success">全部正确</p>';
  }
  return html;
}

function exportResourceReport(paperId) {
  var records = getLatestPerStudent(getHwRecordsByPaperId(paperId));
  if (!records.length) {
    alert('暂无数据');
    return;
  }
  var paperName = records[0].paper_name || '未知';
  var grade = document.getElementById('gradeSelect').value;
  var className = document.getElementById('classSelect').value;
  var totalStudents = currentStudents.length;
  var submittedSet = new Set();
  records.forEach(function (d) {
    if (isSubmittedRow(d)) submittedSet.add(sid(d));
  });
  var doerCount = submittedSet.size;
  var notSubmitted = currentStudents.filter(function (s) {
    return !submittedSet.has(s.student_id);
  });
  var avgDec = calcCorrectRate(records);
  var avgText = avgDec !== null ? formatPercent(avgDec) : '--';

  var reportHtml =
    '<html><head><meta charset="UTF-8"><title>试卷分析报告 - ' +
    escapeHtml(paperName) +
    '</title><style>body{font-family:PingFang SC,Microsoft YaHei,sans-serif;padding:24px;font-size:14px;line-height:1.8;}' +
    'table{width:100%;border-collapse:collapse;margin:16px 0;}th,td{padding:8px 12px;border:1px solid #ddd;text-align:left;}' +
    'th{background:#f5f5f5;}.error{color:#EF4444;}</style></head><body>';
  reportHtml += '<h2>试卷分析报告</h2>';
  reportHtml +=
    '<p><strong>学校：</strong>' +
    escapeHtml(AppState.getSchoolDisplayName()) +
    ' | <strong>班级：</strong>' +
    escapeHtml(grade + className) +
    '</p>';
  reportHtml += '<p><strong>试卷：</strong>' + escapeHtml(paperName) + '</p>';
  reportHtml += '<p><strong>数据时段：</strong>' + hwPeriodLabel() + '</p><hr>';
  reportHtml += '<h3>一、提交情况</h3>';
  reportHtml +=
    '<p>应交 ' +
    totalStudents +
    ' 人，已交 ' +
    doerCount +
    ' 人，提交率 ' +
    (totalStudents > 0 ? calcPercent(doerCount, totalStudents) : 0) +
    '%</p>';
  if (notSubmitted.length) {
    reportHtml +=
      '<p class="error">未提交：' +
      escapeHtml(notSubmitted.map(function (s) { return s.student_name; }).join('、')) +
      '</p>';
  }
  reportHtml += '<h3>二、正确率</h3><p>班级平均正确率：' + avgText + '</p>';
  reportHtml += '<h3>三、题目分析</h3>' + renderResourceDetailContent(records);
  reportHtml += '</body></html>';

  var win = window.open('', '_blank');
  if (!win) {
    alert('请允许弹出窗口以导出');
    return;
  }
  win.document.write(reportHtml);
  win.document.close();
  setTimeout(function () {
    win.print();
  }, 500);
}

/* ==================== 板块三：学情分析（对齐驾驶舱，班级维度） ==================== */

function getClassStudentIdSet() {
  var set = new Set();
  currentStudents.forEach(function (s) {
    var id = s.student_id;
    if (id) set.add(id);
  });
  return set;
}

function classBarColorForRate(rawRate) {
  var r = Number(rawRate);
  if (!Number.isFinite(r)) return '#EF4444';
  if (r >= 80) return '#10B981';
  if (r >= 60) return '#3B82F6';
  return '#EF4444';
}

function collectClassDateKeys(rows) {
  return collectDailyActiveDates(rows);
}

function isHwRecordSubmitted(d) {
  return isExamSubmitted(d);
}

function renderClassSsTrendChart() {
  var records = filterDailyActiveRecords(currentDailyActive, {
    startDate: dateRangeStart,
    endDate: dateRangeEnd,
  });
  var dates = collectDailyActiveDates(records);
  var counts = dates.map(function (dk) {
    return countDailyActiveUsersOnDate(records, dk);
  });
  var labels = typeof formatShortDate === 'function' ? dates.map(formatShortDate) : dates;

  disposeChartDom('ssTrendChart');
  var dom = document.getElementById('ssTrendChart');
  if (!dom || typeof echarts === 'undefined') return;
  dom.innerHTML = '';
  initEchartInstance(dom, function (chart) {
    classSsTrendInst = chart;
    chart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          var p = params[0];
          return (p.axisValueLabel || p.name) + '<br/>活跃人数：' + p.data;
        },
      },
      grid: buildActiveTrendChartGrid(labels),
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLabel: { color: '#6B7280', rotate: labels.length > 20 ? 45 : 0 },
      },
      yAxis: buildActiveTrendYAxis(),
      series: [
        {
          type: 'line',
          data: counts,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#8B1A1A', width: 2 },
          itemStyle: { color: '#8B1A1A' },
          animationDuration: 600,
        },
      ],
    });
  });
}

function escapeAttrClass(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

function collectClassWeakKnowledgePoints(limit) {
  var studentIds = getClassStudentIdSet();
  var data = filterByCurrentSubject(currentKnowledgeMastery);
  var map = {};
  data.forEach(function (d) {
    if (!studentIds.has(sid(d))) return;
    var mastered = String(d.is_mastered != null ? d.is_mastered : d['掌握状态'] || '').trim();
    if (mastered !== '未掌握') return;
    var kp = d.knowledge_point || d['知识点'] || '';
    if (!kp) return;
    if (!map[kp]) map[kp] = { name: kp, subject: rowSubject(d), count: 0 };
    map[kp].count += 1;
  });
  var sorted = Object.keys(map)
    .map(function (k) {
      return map[k];
    })
    .sort(function (a, b) {
      return b.count - a.count;
    });
  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}

function collectClassHighFreqWrongQuestions(maxCount) {
  var studentIds = getClassStudentIdSet();
  if (!studentIds.size) return [];

  var records = filterByCurrentSubject(currentExamDetail.concat(currentPracticeDetail)).filter(
    function (d) {
      return studentIds.has(sid(d)) && isHwRecordSubmitted(d);
    }
  );

  var paperGroups = groupBy(records, 'paper_id');
  var errors = [];

  Object.keys(paperGroups).forEach(function (paperId) {
    var paperRecords = paperGroups[paperId];
    if (!paperRecords.length) return;

    var latest = getLatestPerStudent(paperRecords);
    if (!latest.length) return;

    var meta = paperRecords[0];
    var totalQ = 0;
    paperRecords.forEach(function (d) {
      var tq = parseInt(d.total_questions, 10);
      if (Number.isFinite(tq) && tq > totalQ) totalQ = tq;
    });
    if (!totalQ) return;

    var paperName = String(meta.paper_name || meta['试卷名称'] || '').trim();
    var subject = rowSubject(meta);
    var doerCount = latest.length;

    for (var i = 1; i <= totalQ; i++) {
      var wrongCount = 0;
      latest.forEach(function (d) {
        if (recordHasWrongQuestionNo(paperId, d.wrong_question_ids, i)) wrongCount += 1;
      });
      if (wrongCount <= 0) continue;

      var correctRate =
        doerCount > 0 ? parseFloat((((doerCount - wrongCount) / doerCount) * 100).toFixed(1)) : 0;

      var questionZujuanId =
        typeof getPaperQuestionZujuanId === 'function'
          ? getPaperQuestionZujuanId(paperId, i)
          : String(i);
      var zujuanUrl =
        typeof getPaperQuestionZujuanUrl === 'function'
          ? getPaperQuestionZujuanUrl(paperId, i)
          : typeof buildZujuanQuestionUrl === 'function'
            ? buildZujuanQuestionUrl(questionZujuanId)
            : 'https://zujuan.xkw.com/11q33474302.html';

      errors.push({
        paperId: paperId,
        paperName: paperName,
        subject: subject,
        questionNo: i,
        questionZujuanId: questionZujuanId,
        wrongCount: wrongCount,
        doerCount: doerCount,
        correctRate: correctRate,
        zujuanUrl: zujuanUrl,
      });
    }
  });

  errors.sort(function (a, b) {
    return b.wrongCount - a.wrongCount || a.correctRate - b.correctRate;
  });

  var limit = typeof maxCount === 'number' ? maxCount : 100;
  return errors.slice(0, limit);
}

var CLASS_WEAK_KP_BAR_COLOR = '#8B1A1A';

function classWeakKpCloudColor(ratio) {
  var r = Math.max(0, Math.min(1, Number(ratio) || 0));
  if (r >= 0.72) return '#5c1010';
  if (r >= 0.48) return '#7f1d1d';
  if (r >= 0.28) return '#8B1A1A';
  if (r >= 0.12) return '#a85555';
  return '#c4a8a8';
}

function getClassWeakKpPanelHeight(itemCount) {
  var rows = Math.min(itemCount || 0, 20);
  if (!rows) return 320;
  return Math.max(320, rows * 30 + 48);
}

function renderClassSsTrendFilter() {
  var el = document.getElementById('ssTrendFilter');
  if (el) el.textContent = '按日活跃人数';
}

function renderClassSsSubjectChart() {
  var chartDom = document.getElementById('ssSubjectChart');
  if (!chartDom) return;

  var totalStudents = currentStudents.length || 1;
  var studentIds = getClassStudentIdSet();
  var subjectMap = {};

  function addRecord(d) {
    var subj = rowSubject(d);
    var id = sid(d);
    if (!subj || !id || !studentIds.has(id)) return;
    if (!subjectMap[subj]) subjectMap[subj] = new Set();
    subjectMap[subj].add(id);
  }

  filterByCurrentSubject(currentMaterialDetail).forEach(addRecord);
  filterByCurrentSubject(currentVideoDetail).forEach(addRecord);
  filterByCurrentSubject(currentExamDetail).forEach(addRecord);
  filterByCurrentSubject(currentPracticeDetail).forEach(addRecord);

  var data = Object.keys(subjectMap)
    .map(function (name) {
      return { name: name, value: subjectMap[name].size };
    })
    .sort(function (a, b) {
      return b.value - a.value;
    });

  if (typeof sortSubjectsAsc === 'function' && data.length > 1 && !getCurrentSubject()) {
    data = sortSubjectsAsc(
      data.map(function (x) {
        return x.name;
      })
    ).map(function (name) {
      return { name: name, value: subjectMap[name].size };
    });
  }

  disposeChartDom('ssSubjectChart');
  if (!data.length || typeof echarts === 'undefined') {
    chartDom.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text-light);">暂无数据</div>';
    classSsSubjectInst = null;
    return;
  }

  chartDom.innerHTML = '';
  var h = Math.max(280, data.length * 36 + 48);
  chartDom.style.height = h + 'px';

  var names = data.map(function (x) {
    return x.name;
  });
  var barData = data.map(function (x) {
    var pct = totalStudents > 0 ? (x.value / totalStudents) * 100 : 0;
    return {
      value: x.value,
      itemStyle: {
        color: classBarColorForRate(pct),
        borderRadius: [0, 4, 4, 0],
      },
    };
  });

  initEchartInstance(chartDom, function (chart) {
    classSsSubjectInst = chart;
    subjectChartInst = chart;
    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var p = params[0];
          var v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
          var pct = totalStudents > 0 ? ((v / totalStudents) * 100).toFixed(1) : '0';
          return p.name + '<br/>学习人数：' + v + '人（' + pct + '%）';
        },
      },
      grid: { left: 72, right: 72, top: 16, bottom: 24 },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#6B7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
      },
      yAxis: {
        type: 'category',
        data: names.slice().reverse(),
        axisLabel: { color: '#374151', fontSize: 11 },
        inverse: false,
      },
      series: [
        {
          type: 'bar',
          data: barData.slice().reverse(),
          barWidth: 18,
          label: {
            show: true,
            position: 'right',
            formatter: function (p) {
              var v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
              return v + '人';
            },
            fontSize: 11,
            color: '#374151',
          },
          animationDuration: 600,
        },
      ],
    });
  });
}

function renderClassWeakKnowledgeBarChart(items, panelHeight) {
  var dom = document.getElementById('ssWeakKnowledgeChart');
  if (!dom) return;
  disposeChartDom('ssWeakKnowledgeChart');

  if (!items.length || typeof echarts === 'undefined') {
    dom.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text-light);">暂无数据</div>';
    classSsWeakBarInst = null;
    return;
  }

  var display = items.slice(0, 20);
  dom.innerHTML = '';
  dom.style.height =
    (panelHeight != null ? panelHeight : getClassWeakKpPanelHeight(items.length)) + 'px';

  var names = display.map(function (d) {
    return d.name;
  });
  var seriesData = display.map(function (d) {
    return {
      value: d.count,
      itemStyle: {
        color:
          typeof echarts !== 'undefined' && echarts.graphic
            ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#9f2929' },
                { offset: 1, color: CLASS_WEAK_KP_BAR_COLOR },
              ])
            : CLASS_WEAK_KP_BAR_COLOR,
        borderRadius: [0, 4, 4, 0],
      },
    };
  });

  initEchartInstance(dom, function (chart) {
    classSsWeakBarInst = chart;
    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var p = params[0];
          if (!p) return '';
          var idx = display.length - 1 - p.dataIndex;
          var item = display[idx] || {};
          var v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
          return (
            escapeHtml(item.name || p.name) +
            '<br/>未掌握人次：' +
            v +
            (item.subject ? '<br/>学科：' + escapeHtml(item.subject) : '')
          );
        },
      },
      grid: { left: 108, right: 44, top: 12, bottom: 28 },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#6B7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
      },
      yAxis: {
        type: 'category',
        data: names.slice().reverse(),
        axisLabel: { color: '#374151', fontSize: 11, width: 96, overflow: 'truncate' },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: seriesData.slice().reverse(),
          barWidth: 16,
          label: {
            show: true,
            position: 'right',
            formatter: '{c}',
            fontSize: 11,
            color: '#374151',
          },
          animationDuration: 600,
        },
      ],
    });
  });
}

function renderClassWeakKnowledgeCloud(items, panelHeight) {
  var dom = document.getElementById('ssWeakKnowledgeCloud');
  if (!dom) return;
  disposeChartDom('ssWeakKnowledgeCloud');

  if (!items.length || typeof echarts === 'undefined') {
    dom.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text-light);">暂无数据</div>';
    classSsWeakCloudInst = null;
    return;
  }

  var cloudItems = items.slice(0, 45);
  var maxCount = cloudItems[0].count || 1;
  var minCount = cloudItems[cloudItems.length - 1].count || 1;
  var span = maxCount - minCount || 1;
  var data = cloudItems.map(function (k) {
    var ratio = (k.count - minCount) / span;
    return {
      name: k.name,
      value: k.count,
      textStyle: {
        color: classWeakKpCloudColor(ratio),
        fontWeight: ratio >= 0.45 ? 600 : 500,
      },
    };
  });

  var h = panelHeight != null ? panelHeight : getClassWeakKpPanelHeight(items.length);
  dom.innerHTML = '';
  dom.style.height = h + 'px';

  initEchartInstance(dom, function (chart) {
    classSsWeakCloudInst = chart;
    chart.setOption({
      tooltip: {
        show: true,
        backgroundColor: 'rgba(28, 25, 23, 0.88)',
        borderWidth: 0,
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: function (p) {
          return escapeHtml(p.name) + '<br/>未掌握人次：' + p.value;
        },
      },
      series: [
        {
          type: 'wordCloud',
          shape: 'square',
          left: 'center',
          top: 'center',
          width: '100%',
          height: '100%',
          sizeRange: [14, Math.min(52, Math.round(h * 0.075))],
          rotationRange: [0, 0],
          gridSize: 6,
          drawOutOfBound: false,
          layoutAnimation: true,
          textStyle: {
            fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
            fontWeight: 500,
          },
          emphasis: {
            focus: 'self',
            textStyle: {
              color: '#5c1010',
              fontWeight: 700,
              shadowBlur: 8,
              shadowColor: 'rgba(127, 29, 29, 0.28)',
            },
          },
          data: data,
        },
      ],
    });
  });
}

function renderClassWeakKnowledge() {
  var items = collectClassWeakKnowledgePoints();
  if (!items.length) {
    var chartDom = document.getElementById('ssWeakKnowledgeChart');
    var cloudDom = document.getElementById('ssWeakKnowledgeCloud');
    var empty =
      '<div style="text-align:center;padding:40px;color:var(--text-light);">暂无数据</div>';
    disposeChartDom('ssWeakKnowledgeChart');
    disposeChartDom('ssWeakKnowledgeCloud');
    classSsWeakBarInst = null;
    classSsWeakCloudInst = null;
    if (chartDom) chartDom.innerHTML = empty;
    if (cloudDom) cloudDom.innerHTML = empty;
    return;
  }
  var panelHeight = getClassWeakKpPanelHeight(items.length);
  renderClassWeakKnowledgeBarChart(items, panelHeight);
  renderClassWeakKnowledgeCloud(items, panelHeight);
}

function renderClassHighFreqErrors() {
  var el = document.getElementById('ssHighFreqErrors');
  var footer = document.getElementById('ssHighFreqErrorsFooter');
  if (!el) return;

  var allItems = collectClassHighFreqWrongQuestions(100);
  var displayCount = classSsHighFreqExpanded
    ? Math.min(allItems.length, 100)
    : Math.min(allItems.length, 10);
  var display = allItems.slice(0, displayCount);

  if (!display.length) {
    el.innerHTML = '<div class="high-freq-errors-empty">暂无高频错题数据</div>';
    if (footer) footer.innerHTML = '';
    return;
  }

  el.innerHTML = buildHighFreqErrorsTableHtml(display);

  if (footer) {
    if (allItems.length > 10) {
      footer.innerHTML =
        '<button type="button" class="btn btn-outline btn-sm" onclick="toggleClassHighFreqErrors()">' +
        (classSsHighFreqExpanded ? '收起' : '查看更多') +
        '</button>';
    } else {
      footer.innerHTML = '';
    }
  }
}

function toggleClassHighFreqErrors() {
  classSsHighFreqExpanded = !classSsHighFreqExpanded;
  renderClassHighFreqErrors();
}

function renderClassLearningAnalysis() {
  bindSelfStudyResize();
  if (!isSelfStudyPanelVisible()) return;
  renderClassSsTrendFilter();
  renderClassSsTrendChart();
  renderClassSsSubjectChart();
  renderClassWeakKnowledge();
  renderClassHighFreqErrors();
  scheduleSelfStudyChartResize();
}

function renderSelfStudyPanel() {
  renderClassLearningAnalysis();
}

function renderSelfStudyCharts() {
  renderClassLearningAnalysis();
}

function renderSsSubjectChart() {
  renderClassSsSubjectChart();
}

function renderSsWeakChart() {
  renderClassWeakKnowledge();
}

function renderSsErrorChart() {
  renderClassHighFreqErrors();
}

window.toggleClassHighFreqErrors = toggleClassHighFreqErrors;

function exportStudentDetail() {
  var subject = getCurrentSubject();
  var gradeEl = document.getElementById('gradeSelect');
  var classEl = document.getElementById('classSelect');
  var grade = gradeEl ? gradeEl.value : '';
  var className = classEl ? classEl.value : '';

  var detailData = currentStudents.map(function (s) {
    var activeDays = calcActiveDaysForUser(
      currentDailyActive,
      s.student_id,
      dateRangeStart,
      dateRangeEnd
    );

    var materials = currentMaterialDetail.filter(function (d) {
      return sid(d) === s.student_id;
    });
    var videos = currentVideoDetail.filter(function (d) {
      return sid(d) === s.student_id;
    });
    var exams = currentExamDetail.filter(function (d) {
      return sid(d) === s.student_id;
    });
    var practices = currentPracticeDetail.filter(function (d) {
      return sid(d) === s.student_id;
    });

    if (subject) {
      materials = filterBySubject(materials, subject);
      videos = filterBySubject(videos, subject);
      exams = filterBySubject(exams, subject);
      practices = filterBySubject(practices, subject);
    }

    var examRate = calcCorrectRate(exams);
    var practiceRate = calcCorrectRate(practices);
    var combinedRate = calcCorrectRate(exams.concat(practices));

    return {
      name: s.student_name,
      activeDays: activeDays,
      materialCount: materials.length,
      videoCount: videos.length,
      examCount: exams.length,
      examRate: examRate !== null ? formatPercent(examRate) : '--',
      practiceCount: practices.length,
      practiceRate: practiceRate !== null ? formatPercent(practiceRate) : '--',
      combinedRate: combinedRate !== null ? formatPercent(combinedRate) : '--',
    };
  });

  var html =
    '<html><head><meta charset="UTF-8"><title>学生学习明细</title>' +
    '<style>body{font-family:PingFang SC,Microsoft YaHei,sans-serif;padding:24px;font-size:13px;}' +
    'table{width:100%;border-collapse:collapse;}th,td{padding:8px;border:1px solid #ddd;text-align:center;}' +
    'th{background:#f5f5f5;font-weight:600;}</style></head><body>';
  html += '<h2>学生自主学习明细</h2>';
  html +=
    '<p>' +
    escapeHtml(AppState.getSchoolDisplayName()) +
    ' | ' +
    escapeHtml(grade) +
    escapeHtml(className) +
    (subject ? ' | ' + escapeHtml(subject) : '') +
    '</p>';
  html +=
    '<p>数据时段：' +
    escapeHtml(dateRangeStart || '') +
    ' 至 ' +
    escapeHtml(dateRangeEnd || '') +
    '</p><hr>';
  html +=
    '<table><thead><tr><th>姓名</th><th>学习天数</th><th>查看资料</th><th>观看视频</th><th>考试次数</th><th>考试正确率</th><th>练习次数</th><th>练习正确率</th><th>综合正确率</th></tr></thead><tbody>';

  detailData.forEach(function (d) {
    html +=
      '<tr><td>' +
      escapeHtml(d.name) +
      '</td><td>' +
      d.activeDays +
      '</td><td>' +
      d.materialCount +
      '</td><td>' +
      d.videoCount +
      '</td><td>' +
      d.examCount +
      '</td><td>' +
      escapeHtml(d.examRate) +
      '</td><td>' +
      d.practiceCount +
      '</td><td>' +
      escapeHtml(d.practiceRate) +
      '</td><td>' +
      escapeHtml(d.combinedRate) +
      '</td></tr>';
  });

  html += '</tbody></table></body></html>';

  var win = window.open('', '_blank');
  if (!win) {
    alert('请允许弹出窗口以导出');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(function () {
    win.print();
  }, 500);
}

function renderStudentTable() {
  var subject = getCurrentSubject();

  var tableData = currentStudents.map(function (s) {
    var activeDays = calcActiveDaysForUser(
      currentDailyActive,
      s.student_id,
      dateRangeStart,
      dateRangeEnd
    );
    var exams = currentExamDetail.filter(function (d) {
      return sid(d) === s.student_id;
    });
    var practices = currentPracticeDetail.filter(function (d) {
      return sid(d) === s.student_id;
    });
    if (subject) {
      exams = filterBySubject(exams, subject);
      practices = filterBySubject(practices, subject);
    }
    var combinedRate = calcCorrectRate(exams.concat(practices));
    var totalCount = exams.length + practices.length;

    return {
      id: s.student_id,
      name: s.student_name,
      activeDays: activeDays,
      totalCount: totalCount,
      combinedRate: combinedRate,
    };
  });

  var html =
    '<table class="data-table" id="studentDataTable"><thead><tr>' +
    '<th onclick="sortTable(\'studentDataTable\',0,\'string\')">姓名</th>' +
    '<th onclick="sortTable(\'studentDataTable\',1,\'number\')">学习天数</th>' +
    '<th onclick="sortTable(\'studentDataTable\',2,\'number\')">做题次数</th>' +
    '<th onclick="sortTable(\'studentDataTable\',3,\'number\')">正确率</th>' +
    '</tr></thead><tbody>';

  tableData.forEach(function (s) {
    var rateStr = s.combinedRate !== null ? formatPercent(s.combinedRate) : '--';
    html +=
      '<tr data-name="' +
      escapeHtml(s.name) +
      '"><td><a href="student-detail.html?id=' +
      encodeURIComponent(s.id) +
      '">' +
      escapeHtml(s.name) +
      '</a></td><td>' +
      s.activeDays +
      '天</td><td>' +
      s.totalCount +
      '次</td><td style="color:' +
      getRateColor(s.combinedRate) +
      '">' +
      rateStr +
      '</td></tr>';
  });
  html += '</tbody></table>';
  var tableEl = document.getElementById('ssStudentTable');
  if (tableEl) tableEl.innerHTML = html;
}

function onStudentSearch() {
  var searchEl = document.getElementById('studentSearch');
  if (!searchEl) return;
  var keyword = (searchEl.value || '').trim().toLowerCase();
  var table = document.getElementById('studentDataTable');
  if (!table) return;
  table.querySelectorAll('tbody tr').forEach(function (row) {
    var name = (row.getAttribute('data-name') || row.cells[0].textContent || '').toLowerCase();
    row.style.display = !keyword || name.indexOf(keyword) !== -1 ? '' : 'none';
  });
}

window.onGradeChange = onGradeChange;
window.onClassChange = onClassChange;
window.onSubjectChange = onSubjectChange;
window.switchMainTab = switchMainTab;
window.onStudentSearch = onStudentSearch;
window.changeHomeworkListPage = changeHomeworkListPage;
window.viewHwQuestion = viewHwQuestion;
window.exportResourceReport = exportResourceReport;
window.exportStudentDetail = exportStudentDetail;
window.openPaperDetail = openPaperDetail;
window.closePaperDetail = closePaperDetail;
