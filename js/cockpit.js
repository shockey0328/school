/**
 * 学校驾驶舱：校长视角，数据来自 CSV 实时计算
 */
/* global echarts, AppState, DataLoader, initDashboardLayout, filterBySchool, filterByGrade, filterBySubject, calcActiveDays, hasUsedAnyFunction, isExamScene, isPracticeScene, calcPercent, formatPercent, formatNumber, rowSubject, rowGradeVal, calcCorrectRate, getRateColor, groupBy, buildZujuanQuestionUrl, getPaperQuestionZujuanId, sortGradesAsc, sortSubjectsAsc, DATA_PERIOD_END, calcSessionLearningDurationMinutes, formatTotalLearningDuration, setPaperQuestionMap, normalizeDailyActiveRows, rowDailyActiveUserId, rowDailyActiveLearningDurationMin, filterDailyActiveRecords, collectDailyActiveDates, countDailyActiveUsersOnDate, calcActiveDaysForUser, rowDailyActiveIsActive, formatShortDate, isExamSubmitted, recordHasWrongQuestionNo, buildActiveTrendChartGrid, buildActiveTrendYAxis, applyTenantToRows, ensureSchoolBrands */

let allStudents = [];
let allDailyActive = [];
let allUsageSummary = [];
let allMaterialDetail = [];
let allVideoDetail = [];
let allExamDetail = [];
let allPracticeDetail = [];
let allKnowledgeMastery = [];
let gradeList = [];
let subjectList = [];

let dailyChartInst = null;
let coverageChartInst = null;
let classChartInst = null;
let ssTrendChartInst = null;
let ssSubjectChartInst = null;
let ssWeakBarChartInst = null;
let ssWeakCloudChartInst = null;
let ssHighFreqErrorExpanded = false;

function sid(row) {
  return rowStudentId(row);
}

function sGrade(row) {
  if (!row) return '';
  return String(row.grade != null ? row.grade : row['年级'] || '').trim();
}

function sClass(row) {
  if (!row) return '';
  return String(row.class_name != null ? row.class_name : row['班级'] || '').trim();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

/** 与 usage_summary 中英文字段兼容的「是否使用过任意功能」 */
function usageHasAny(row) {
  if (!row) return false;
  function pos(a, b) {
    const v = Number(a != null && a !== '' ? a : b);
    return Number.isFinite(v) && v > 0;
  }
  return (
    pos(row.view_count, row['浏览次数']) ||
    pos(row.watch_count, row['观看次数']) ||
    pos(row.practice_count, row['练习次数']) ||
    pos(row.download_count, row['下载次数']) ||
    pos(row.photo_search_count, row['拍搜次数']) ||
    pos(row.companion_visit_count, row['伴学次数'])
  );
}

function uniqGrades(students) {
  const set = new Set();
  (students || []).forEach(function (s) {
    const g = sGrade(s);
    if (g) set.add(g);
  });
  return typeof sortGradesAsc === 'function'
    ? sortGradesAsc(Array.from(set))
    : Array.from(set).sort(function (a, b) {
        return a.localeCompare(b, 'zh-CN');
      });
}

function disposeChart(domId) {
  const el = document.getElementById(domId);
  if (!el || typeof echarts === 'undefined') return;
  const inst = echarts.getInstanceByDom(el);
  if (inst) inst.dispose();
}

function sName(row) {
  if (!row) return '';
  return String(row.student_name != null ? row.student_name : row['姓名'] || '').trim();
}

function getGlobalGrade() {
  const el = document.getElementById('globalGradeFilter');
  return el ? String(el.value || '').trim() : '';
}

function getGlobalSubject() {
  const el = document.getElementById('globalSubjectFilter');
  return el ? String(el.value || '').trim() : '';
}

function getFilteredStudents() {
  let students = allStudents;
  const grade = getGlobalGrade();
  if (grade) students = filterByGrade(students, grade);
  return students;
}

function getFilteredExamDetail() {
  let data = allExamDetail;
  const grade = getGlobalGrade();
  const subject = getGlobalSubject();
  if (grade) {
    const gradeStudentIds = filterByGrade(allStudents, grade).map(sid).filter(Boolean);
    const idSet = new Set(gradeStudentIds);
    data = data.filter(function (d) {
      return idSet.has(sid(d));
    });
  }
  if (subject) data = filterBySubject(data, subject);
  return data;
}

function getFilteredPracticeDetail() {
  let data = allPracticeDetail;
  const grade = getGlobalGrade();
  const subject = getGlobalSubject();
  if (grade) {
    const gradeStudentIds = filterByGrade(allStudents, grade).map(sid).filter(Boolean);
    const idSet = new Set(gradeStudentIds);
    data = data.filter(function (d) {
      return idSet.has(sid(d));
    });
  }
  if (subject) data = filterBySubject(data, subject);
  return data;
}

function getFilteredMaterialDetail() {
  let data = allMaterialDetail;
  const grade = getGlobalGrade();
  const subject = getGlobalSubject();
  if (grade) {
    const gradeStudentIds = filterByGrade(allStudents, grade).map(sid).filter(Boolean);
    const idSet = new Set(gradeStudentIds);
    data = data.filter(function (d) {
      return idSet.has(sid(d));
    });
  }
  if (subject) data = filterBySubject(data, subject);
  return data;
}

function getFilteredVideoDetail() {
  let data = allVideoDetail;
  const grade = getGlobalGrade();
  const subject = getGlobalSubject();
  if (grade) {
    const gradeStudentIds = filterByGrade(allStudents, grade).map(sid).filter(Boolean);
    const idSet = new Set(gradeStudentIds);
    data = data.filter(function (d) {
      return idSet.has(sid(d));
    });
  }
  if (subject) data = filterBySubject(data, subject);
  return data;
}

function getFilteredKnowledgeMastery() {
  let data = allKnowledgeMastery;
  const grade = getGlobalGrade();
  const subject = getGlobalSubject();
  if (grade) {
    const gradeStudentIds = filterByGrade(allStudents, grade).map(sid).filter(Boolean);
    const idSet = new Set(gradeStudentIds);
    data = data.filter(function (d) {
      return idSet.has(sid(d));
    });
  }
  if (subject) data = filterBySubject(data, subject);
  return data;
}

function getFilteredDailyActive() {
  const idSet = new Set(
    getFilteredStudents()
      .map(sid)
      .filter(Boolean)
  );
  return allDailyActive.filter(function (d) {
    return idSet.has(rowDailyActiveUserId(d));
  });
}

function getFilteredUsageSummary() {
  const idSet = new Set(
    getFilteredStudents()
      .map(sid)
      .filter(Boolean)
  );
  return allUsageSummary.filter(function (u) {
    return idSet.has(sid(u));
  });
}

function buildSubjectList() {
  const set = new Set();
  [allExamDetail, allPracticeDetail, allMaterialDetail, allVideoDetail, allKnowledgeMastery].forEach(function (arr) {
    (arr || []).forEach(function (d) {
      const s = rowSubject(d);
      if (s) set.add(s);
    });
  });
  return typeof sortSubjectsAsc === 'function'
    ? sortSubjectsAsc(Array.from(set))
    : Array.from(set).sort(function (a, b) {
        return a.localeCompare(b, 'zh-CN');
      });
}

function getTableGradeList() {
  const g = getGlobalGrade();
  if (g) return [g];
  return uniqGrades(getFilteredStudents());
}

function onGlobalFilterChange() {
  ssHighFreqErrorExpanded = false;
  renderCoreMetrics();
  renderLearningPanel();
}

function getStudentIdSetForGrade(grade) {
  const set = new Set();
  getFilteredStudents().forEach(function (s) {
    if (grade && sGrade(s) !== grade) return;
    const id = sid(s);
    if (id) set.add(id);
  });
  return set;
}

function getDailyRowsForGrade(grade) {
  const set = getStudentIdSetForGrade(grade);
  return getFilteredDailyActive().filter(function (d) {
    return set.has(rowDailyActiveUserId(d));
  });
}

function countActiveStudentsFromDaily() {
  const activeUsers = new Set();
  getFilteredDailyActive().forEach(function (row) {
    if (!rowDailyActiveIsActive(row)) return;
    activeUsers.add(rowDailyActiveUserId(row));
  });
  return activeUsers.size;
}

function countUsageStudents() {
  const idSet = new Set();
  getFilteredUsageSummary().forEach(function (row) {
    if (!usageHasAny(row)) return;
    const id = sid(row);
    if (id) idSet.add(id);
  });
  return idSet.size;
}

function renderCoreMetrics() {
  const el = document.getElementById('coreMetrics');
  if (!el) return;

  const subjectFiltered = !!getGlobalSubject();
  el.classList.toggle('core-metrics-grid--4', subjectFiltered);

  const students = getFilteredStudents();
  const totalStudents = students.length;
  const studentIds = new Set(students.map(sid).filter(Boolean));

  if (!totalStudents) {
    el.innerHTML =
      '<div class="metric-card metric-card--stat" style="grid-column:1/-1;text-align:center;">' +
      '<div class="metric-label">' +
      escapeHtml('当前筛选条件下暂无学生数据，请调整年级/学科或核对学校数据。') +
      '</div></div>';
    return;
  }

  const examData = getFilteredExamDetail().filter(function (d) {
    return studentIds.has(sid(d));
  });
  const practiceData = getFilteredPracticeDetail().filter(function (d) {
    return studentIds.has(sid(d));
  });
  const materialData = getFilteredMaterialDetail().filter(function (d) {
    return studentIds.has(sid(d));
  });
  const videoData = getFilteredVideoDetail().filter(function (d) {
    return studentIds.has(sid(d));
  });

  const allRecords = materialData.concat(videoData, examData, practiceData);
  const participantIds = new Set();
  allRecords.forEach(function (d) {
    const id = sid(d);
    if (id) participantIds.add(id);
  });
  const participantCount = participantIds.size;
  const participantRate =
    totalStudents > 0 ? ((participantCount / totalStudents) * 100).toFixed(1) : '0.0';
  const totalLearningActions = allRecords.length;

  let html =
    renderMetricCardHtml(escapeHtml(formatNumber(totalStudents)), '全校学生总数') +
    renderMetricCardHtml(escapeHtml(formatNumber(participantCount)), '学习参与人数') +
    renderMetricCardHtml(escapeHtml(participantRate) + '%', '学习参与率') +
    renderMetricCardHtml(escapeHtml(formatNumber(totalLearningActions)), '累计学习次数');

  if (!subjectFiltered) {
    const totalDuration = formatTotalLearningDuration(
      calcSessionLearningDurationMinutes({
        studentIdSet: studentIds,
        dailyActiveRecords: getFilteredDailyActive(),
      })
    );
    html += renderMetricCardHtml(escapeHtml(totalDuration.value), '学习总时长', {
      unit: totalDuration.unit,
    });
  }

  el.innerHTML = html;
}

function fillFilters() {
  const gradeOpts =
    '<option value="">全部年级</option>' +
    gradeList
      .map(function (g) {
        return '<option value="' + escapeAttr(g) + '">' + escapeHtml(g) + '</option>';
      })
      .join('');
  const gradeEl = document.getElementById('globalGradeFilter');
  const subjectEl = document.getElementById('globalSubjectFilter');
  if (gradeEl) gradeEl.innerHTML = gradeOpts;
  if (subjectEl) {
    subjectEl.innerHTML =
      '<option value="">全部学科</option>' +
      subjectList
        .map(function (s) {
          return '<option value="' + escapeAttr(s) + '">' + escapeHtml(s) + '</option>';
        })
        .join('');
  }

  const user = AppState.getUser();
  if (user) {
    const role = user.role || AppState.getRole() || '';
    const grade = user.grade || AppState.getGrade() || '';
    const subject = user.subject || AppState.getSubject() || '';
    if (role === '年级组长' && grade && gradeEl) {
      gradeEl.value = grade;
    }
    if (role === '学科组长') {
      if (subject && subjectEl) subjectEl.value = subject;
      if (grade && gradeEl) gradeEl.value = grade;
    }
  }
}

function getLatestPerStudentHw(records) {
  const map = {};
  (records || []).forEach(function (d) {
    const id = sid(d);
    if (!id) return;
    if (!map[id] || String(d.submit_time || '') > String(map[id].submit_time || '')) {
      map[id] = d;
    }
  });
  return Object.keys(map).map(function (k) {
    return map[k];
  });
}

function renderLearningPanel() {
  renderSsTrendFilter();
  renderSsTrendChart();
  renderSsSubjectChart();
  renderWeakKnowledge();
  renderHighFreqErrors();
  requestAnimationFrame(function () {
    if (ssTrendChartInst) ssTrendChartInst.resize();
    if (ssSubjectChartInst) ssSubjectChartInst.resize();
    if (ssWeakBarChartInst) ssWeakBarChartInst.resize();
    if (ssWeakCloudChartInst) ssWeakCloudChartInst.resize();
  });
}

function renderSsTrendFilter() {
  const el = document.getElementById('ssTrendFilter');
  if (!el) return;
  el.textContent = '按日活跃人数';
}

function renderSsTrendChart() {
  const grade = getGlobalGrade();
  const records = grade ? getDailyRowsForGrade(grade) : getFilteredDailyActive();
  const dates = collectDailyActiveDates(records);
  const counts = dates.map(function (dk) {
    return countDailyActiveUsersOnDate(records, dk);
  });
  const labels = dates.map(formatShortDate);

  disposeChart('ssTrendChart');
  const dom = document.getElementById('ssTrendChart');
  if (!dom || typeof echarts === 'undefined') return;
  dom.innerHTML = '';
  ssTrendChartInst = echarts.init(dom);
  ssTrendChartInst.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        const p = params[0];
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
}

function renderSsSubjectChart() {
  const chartDom = document.getElementById('ssSubjectChart');
  if (!chartDom) return;

  const students = getFilteredStudents();
  const totalStudents = students.length || 1;
  const studentIds = new Set(students.map(sid).filter(Boolean));

  const subjectMap = {};
  function addRecord(d) {
    const subj = rowSubject(d);
    const id = sid(d);
    if (!subj || !id || !studentIds.has(id)) return;
    if (!subjectMap[subj]) subjectMap[subj] = new Set();
    subjectMap[subj].add(id);
  }

  getFilteredMaterialDetail().forEach(addRecord);
  getFilteredVideoDetail().forEach(addRecord);
  getFilteredExamDetail().forEach(addRecord);
  getFilteredPracticeDetail().forEach(addRecord);

  const data = Object.keys(subjectMap)
    .map(function (name) {
      return { name: name, value: subjectMap[name].size };
    })
    .sort(function (a, b) {
      return b.value - a.value;
    });

  disposeChart('ssSubjectChart');
  if (!data.length || typeof echarts === 'undefined') {
    chartDom.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text-light);">暂无数据</div>';
    ssSubjectChartInst = null;
    return;
  }

  chartDom.innerHTML = '';
  const h = Math.max(280, data.length * 36 + 48);
  chartDom.style.height = h + 'px';

  const names = data.map(function (x) {
    return x.name;
  });
  const barData = data.map(function (x) {
    const pct = totalStudents > 0 ? (x.value / totalStudents) * 100 : 0;
    return {
      value: x.value,
      itemStyle: {
        color: classBarColorForRate(pct),
        borderRadius: [0, 4, 4, 0],
      },
    };
  });

  ssSubjectChartInst = echarts.init(chartDom);
  ssSubjectChartInst.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params) {
        const p = params[0];
        const v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
        const pct = totalStudents > 0 ? ((v / totalStudents) * 100).toFixed(1) : '0';
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
            const v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
            return v + '人';
          },
          fontSize: 11,
          color: '#374151',
        },
        animationDuration: 600,
      },
    ],
  });
}

function renderDailyChart() {
  const grade = getGlobalGrade();
  const records = grade ? getDailyRowsForGrade(grade) : getFilteredDailyActive();
  const dates = collectDailyActiveDates(records);
  const counts = dates.map(function (dk) {
    return countDailyActiveUsersOnDate(records, dk);
  });
  const labels = dates.map(formatShortDate);

  disposeChart('dailyChart');
  const dom = document.getElementById('dailyChart');
  if (!dom || typeof echarts === 'undefined') return;
  dailyChartInst = echarts.init(dom);
  dailyChartInst.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        const p = params[0];
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
        symbol: 'circle',
        symbolSize: 6,
        clip: true,
        lineStyle: { color: '#8B1A1A', width: 2 },
        itemStyle: { color: '#8B1A1A' },
        emphasis: {
          focus: 'series',
          scale: false,
          itemStyle: { borderWidth: 0 },
        },
        animationDuration: 600,
      },
    ],
  });
}

function coverageRate(count) {
  const t = getFilteredStudents().length || 1;
  return (count / t) * 100;
}

function renderCoverageChart() {
  const total = getFilteredStudents().length || 1;
  const studentIds = new Set(
    getFilteredStudents()
      .map(sid)
      .filter(Boolean)
  );

  function cntUsage(pred) {
    const set = new Set();
    getFilteredUsageSummary().forEach(function (row) {
      if (!pred(row)) return;
      const id = sid(row);
      if (id) set.add(id);
    });
    return set.size;
  }

  const examSet = new Set();
  getFilteredExamDetail().forEach(function (row) {
    if (!studentIds.has(sid(row))) return;
    const scene = row['考试场景'] != null ? row['考试场景'] : row.scene;
    if (!isExamScene(scene)) return;
    const id = sid(row);
    if (id) examSet.add(id);
  });

  const pracSet = new Set();
  getFilteredPracticeDetail().forEach(function (row) {
    if (!studentIds.has(sid(row))) return;
    const scene = row['练习场景'] != null ? row['练习场景'] : row.scene;
    if (!isPracticeScene(scene)) return;
    const id = sid(row);
    if (id) pracSet.add(id);
  });

  const items = [
    {
      name: '查资料',
      rate: coverageRate(
        cntUsage(function (r) {
          const v = Number(r.view_count != null ? r.view_count : r['浏览次数']);
          return Number.isFinite(v) && v > 0;
        })
      ),
    },
    {
      name: '下载',
      rate: coverageRate(
        cntUsage(function (r) {
          const v = Number(r.download_count != null ? r.download_count : r['下载次数']);
          return Number.isFinite(v) && v > 0;
        })
      ),
    },
    { name: '刷卷', rate: coverageRate(examSet.size) },
    { name: '练习', rate: coverageRate(pracSet.size) },
    {
      name: '看视频',
      rate: coverageRate(
        cntUsage(function (r) {
          const v = Number(r.watch_count != null ? r.watch_count : r['观看次数']);
          return Number.isFinite(v) && v > 0;
        })
      ),
    },
    {
      name: '拍搜',
      rate: coverageRate(
        cntUsage(function (r) {
          const v = Number(r.photo_search_count != null ? r.photo_search_count : r['拍搜次数']);
          return Number.isFinite(v) && v > 0;
        })
      ),
    },
    {
      name: '伴学',
      rate: coverageRate(
        cntUsage(function (r) {
          const v = Number(r.companion_visit_count != null ? r.companion_visit_count : r['伴学次数']);
          return Number.isFinite(v) && v > 0;
        })
      ),
    },
  ];

  items.sort(function (a, b) {
    return b.rate - a.rate;
  });

  disposeChart('coverageChart');
  const dom = document.getElementById('coverageChart');
  if (!dom || typeof echarts === 'undefined') return;
  coverageChartInst = echarts.init(dom);
  coverageChartInst.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params) {
        const p = params[0];
        const v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
        return p.name + '<br/>覆盖率：' + Number(v).toFixed(1) + '%';
      },
    },
    grid: { left: 100, right: 72, top: 16, bottom: 24 },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%', color: '#6B7280' },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    yAxis: {
      type: 'category',
      data: items.map(function (x) {
        return x.name;
      }),
      axisLabel: { color: '#374151' },
      inverse: true,
    },
    series: [
      {
        type: 'bar',
        data: items.map(function (x) {
          return { value: Number(x.rate.toFixed(1)), itemStyle: { color: '#8B1A1A', borderRadius: [0, 4, 4, 0] } };
        }),
        barWidth: 20,
        label: {
          show: true,
          position: 'right',
          formatter: function (p) {
            const v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
            return Number(v).toFixed(1) + '%';
          },
          color: '#374151',
        },
        animationDuration: 600,
      },
    ],
  });
}

function progressCell(rate) {
  const r = Math.min(100, Math.max(0, Number(rate) || 0));
  const t = r.toFixed(1);
  return (
    '<div style="display:flex;align-items:center;gap:8px;">' +
    '<span>' +
    t +
    '%</span>' +
    '<div class="progress-bar" style="width:60px;">' +
    '<div class="progress-fill" style="width:' +
    t +
    '%;background:#8B1A1A;"></div>' +
    '</div></div>'
  );
}

function studentsByGrade(g) {
  return getFilteredStudents().filter(function (s) {
    return sGrade(s) === g;
  });
}

function gradeMetrics(grade) {
  const studs = studentsByGrade(grade);
  const n = studs.length || 1;
  const idSet = new Set(studs.map(sid).filter(Boolean));

  const activeUsers = new Set();
  getFilteredDailyActive().forEach(function (row) {
    if (!idSet.has(rowDailyActiveUserId(row))) return;
    if (rowDailyActiveIsActive(row)) activeUsers.add(rowDailyActiveUserId(row));
  });
  const active = activeUsers.size;

  let usageN = 0;
  getFilteredUsageSummary().forEach(function (row) {
    if (!idSet.has(sid(row))) return;
    if (usageHasAny(row)) usageN += 1;
  });

  let durationMin = 0;
  getFilteredDailyActive().forEach(function (row) {
    if (!idSet.has(rowDailyActiveUserId(row))) return;
    durationMin += rowDailyActiveLearningDurationMin(row);
  });

  const examSet = new Set();
  getFilteredExamDetail().forEach(function (row) {
    if (!idSet.has(sid(row))) return;
    if (sid(row)) examSet.add(sid(row));
  });

  const pracSet = new Set();
  getFilteredPracticeDetail().forEach(function (row) {
    if (!idSet.has(sid(row))) return;
    if (sid(row)) pracSet.add(sid(row));
  });

  let videoN = 0;
  getFilteredUsageSummary().forEach(function (row) {
    if (!idSet.has(sid(row))) return;
    const w = Number(row.watch_count != null ? row.watch_count : row['观看次数']);
    if (Number.isFinite(w) && w > 0) videoN += 1;
  });

  const total = studs.length;
  return {
    grade: grade,
    n: total,
    activeRate: total ? (active / total) * 100 : 0,
    usageRate: total ? (usageN / total) * 100 : 0,
    avgMin: total ? Math.round(durationMin / total) : 0,
    examRate: total ? (examSet.size / total) * 100 : 0,
    pracRate: total ? (pracSet.size / total) * 100 : 0,
    videoRate: total ? (videoN / total) * 100 : 0,
  };
}

function renderGradeTable() {
  const el = document.getElementById('gradeTable');
  const grades = getTableGradeList();
  if (!grades.length) {
    el.innerHTML = '<p class="metric-label">暂无年级数据</p>';
    return;
  }
  const rows = grades.map(function (g) {
    return gradeMetrics(g);
  });
  let html =
    '<table class="data-table"><thead><tr>' +
    '<th>年级</th><th>学生数</th><th>活跃率</th><th>使用率</th><th>人均学习时长</th>' +
    '<th>刷卷参与率</th><th>练习参与率</th><th>视频观看率</th>' +
    '</tr></thead><tbody>';
  rows.forEach(function (m) {
    html +=
      '<tr>' +
      '<td>' +
      escapeHtml(m.grade) +
      '</td>' +
      '<td>' +
      m.n +
      '</td>' +
      '<td>' +
      progressCell(m.activeRate) +
      '</td>' +
      '<td>' +
      progressCell(m.usageRate) +
      '</td>' +
      '<td>' +
      m.avgMin +
      ' 分钟</td>' +
      '<td>' +
      progressCell(m.examRate) +
      '</td>' +
      '<td>' +
      progressCell(m.pracRate) +
      '</td>' +
      '<td>' +
      progressCell(m.videoRate) +
      '</td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function classBarColorForRate(rawRate) {
  const r = Number(rawRate);
  if (!Number.isFinite(r)) return '#EF4444';
  if (r >= 80) return '#10B981';
  if (r >= 60) return '#3B82F6';
  return '#EF4444';
}

function isOmitClassLabel(name) {
  return String(name || '').indexOf('省略') >= 0;
}

function smartSliceClassData(classData, gradeFilter) {
  if (gradeFilter) {
    return { data: classData, useScroll: false, total: classData.length };
  }
  return {
    data: classData,
    useScroll: classData.length > 10,
    total: classData.length,
  };
}

function getClassChartScrollWrap(chartDom) {
  if (!chartDom || !chartDom.parentNode) return null;
  var wrap = chartDom.parentElement;
  if (wrap && wrap.classList && wrap.classList.contains('class-chart-scroll')) {
    return wrap;
  }
  wrap = document.createElement('div');
  wrap.className = 'class-chart-scroll';
  chartDom.parentNode.insertBefore(wrap, chartDom);
  wrap.appendChild(chartDom);
  return wrap;
}

function updateClassChartScrollTip(chartDom, useScroll, total, gradeFilter) {
  var wrap = getClassChartScrollWrap(chartDom);
  if (!wrap) return;
  var tipEl = wrap.parentElement && wrap.parentElement.querySelector('.class-chart-scroll-tip');
  if (!tipEl && wrap.parentElement) {
    tipEl = document.createElement('div');
    tipEl.className = 'class-chart-scroll-tip';
    wrap.parentElement.appendChild(tipEl);
  }
  if (!tipEl) return;
  if (useScroll && total > 10) {
    tipEl.textContent =
      '共 ' +
      total +
      ' 个班级（按' +
      (gradeFilter ? '当前年级' : '全校') +
      '从高到低排列），可在图表区域内上下滚动查看全部。也可在顶部筛选具体年级以聚焦查看。';
    tipEl.style.display = 'block';
  } else {
    tipEl.style.display = 'none';
    tipEl.textContent = '';
  }
}

function renderSmartClassBarChart(domId, list, valueKey, labelSuffix, instHolder, gradeFilter, chartOptions) {
  const dom = document.getElementById(domId);
  if (!dom) return null;

  const opts = chartOptions || {};
  const valueType = opts.valueType || 'percent';
  const isPercent = valueType === 'percent';
  const valueUnit = opts.unit != null ? opts.unit : isPercent ? '%' : '';

  const gFilter = gradeFilter != null ? gradeFilter : getGlobalGrade();
  const sortedDesc = list
    .filter(function (x) {
      const v = x[valueKey];
      return v != null && Number.isFinite(Number(v));
    })
    .slice()
    .sort(function (a, b) {
      return Number(b[valueKey]) - Number(a[valueKey]);
    });

  const sliceResult = smartSliceClassData(sortedDesc, gFilter);
  const displayData = sliceResult.data;
  const useScroll = sliceResult.useScroll;
  const total = sliceResult.total;

  disposeChart(domId);
  if (!displayData.length || typeof echarts === 'undefined') {
    dom.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text-light);">暂无数据</div>';
    updateClassChartScrollTip(dom, false, 0, gFilter);
    if (instHolder === 'ss') ssClassChartInst = null;
    return null;
  }

  const scrollWrap = getClassChartScrollWrap(dom);
  if (scrollWrap) {
    if (useScroll) {
      scrollWrap.classList.add('class-chart-scroll--active');
    } else {
      scrollWrap.classList.remove('class-chart-scroll--active');
    }
  }

  dom.innerHTML = '';
  const rowHeight = 34;
  const axisReserve = useScroll ? 48 : 40;
  dom.style.height = Math.max(220, displayData.length * rowHeight + axisReserve) + 'px';
  dom.style.boxSizing = 'border-box';
  dom.style.paddingBottom = useScroll ? '8px' : '4px';

  let yData = displayData.map(function (d) {
    return d.label;
  });
  let seriesData = displayData.map(function (d) {
    const raw = Number(d[valueKey]);
    const v = isPercent ? Number(raw.toFixed(1)) : Math.round(raw);
    const barColor =
      typeof opts.barColor === 'string'
        ? opts.barColor
        : isPercent
          ? classBarColorForRate(v)
          : '#8B1A1A';
    return {
      value: v,
      itemStyle: {
        color: barColor,
        borderRadius: [0, 4, 4, 0],
      },
    };
  });
  const metaList = displayData.slice().reverse();

  yData = yData.reverse();
  seriesData = seriesData.reverse();

  const inst = echarts.init(dom);
  inst.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params) {
        const p = params[0];
        if (!p || isOmitClassLabel(p.name)) return '';
        const v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
        return p.name + '<br/>' + labelSuffix + '：' + v + valueUnit;
      },
    },
    grid: {
      left: 110,
      right: 56,
      top: useScroll ? 40 : 16,
      bottom: useScroll ? 12 : 36,
      containLabel: false,
    },
    xAxis: {
      type: 'value',
      position: useScroll ? 'top' : 'bottom',
      max: isPercent ? 100 : null,
      minInterval: isPercent ? null : 1,
      axisLine: { show: true, lineStyle: { color: '#E5E7EB' } },
      axisLabel: {
        formatter: isPercent ? '{value}%' : '{value}',
        fontSize: 11,
        color: '#6B7280',
        margin: 8,
        showMinLabel: true,
        showMaxLabel: true,
      },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    yAxis: {
      type: 'category',
      data: yData,
      axisLabel: { fontSize: 11, color: '#374151', width: 100, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        data: seriesData,
        barWidth: 16,
        label: {
          show: true,
          position: 'right',
          formatter: function (p) {
            const v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
            if (v === 0 || v === '0') return isPercent ? '0%' : '0' + valueUnit;
            if (!v) return '';
            return String(v) + valueUnit;
          },
          fontSize: 11,
          color: '#374151',
        },
        animationDuration: 600,
      },
    ],
  });

  inst.off('click');
  inst.on('click', function (params) {
    if (isOmitClassLabel(params.name)) return;
    const item = metaList[params.dataIndex];
    if (!item) return;
    const grade = item.grade || getGlobalGrade() || '';
    const cls = item.cls || '';
    window.location.href =
      'diagnosis.html?grade=' + encodeURIComponent(grade) + '&class=' + encodeURIComponent(cls);
  });

  updateClassChartScrollTip(dom, useScroll, total, gFilter);

  if (instHolder === 'ss') ssClassChartInst = inst;

  requestAnimationFrame(function () {
    inst.resize();
    setTimeout(function () {
      inst.resize();
    }, 80);
  });

  return inst;
}

function bindClassChartNavigate(chart, list) {
  if (!chart || !list || !list.length) return;
  chart.off('click');
  chart.on('click', function (params) {
    const item = list[params.dataIndex];
    if (!item) return;
    const grade = item.grade || getGlobalGrade() || '';
    const cls = item.cls || '';
    window.location.href =
      'diagnosis.html?grade=' + encodeURIComponent(grade) + '&class=' + encodeURIComponent(cls);
  });
}

function buildClassStatsList() {
  const studs = getFilteredStudents();
  const map = {};
  studs.forEach(function (s) {
    const g = sGrade(s);
    const c = sClass(s);
    const key = g + '\t' + c;
    if (!map[key]) map[key] = { grade: g, cls: c, ids: [] };
    const id = sid(s);
    if (id) map[key].ids.push(id);
  });

  const examData = getFilteredExamDetail();
  const practiceData = getFilteredPracticeDetail();
  const materialData = getFilteredMaterialDetail();
  const videoData = getFilteredVideoDetail();
  const idSetAll = new Set(studs.map(sid).filter(Boolean));
  const activeSet = new Set();
  getFilteredDailyActive().forEach(function (row) {
    const id = rowDailyActiveUserId(row);
    if (!idSetAll.has(id)) return;
    if (rowDailyActiveIsActive(row)) activeSet.add(id);
  });

  const list = [];
  Object.keys(map).forEach(function (k) {
    const o = map[k];
    const size = o.ids.length;
    if (!size) return;
    const idSet = new Set(o.ids);
    let activeN = 0;
    o.ids.forEach(function (id) {
      if (activeSet.has(id)) activeN += 1;
    });
    const activeRate = (activeN / size) * 100;

    const records = materialData
      .concat(videoData, examData, practiceData)
      .filter(function (d) {
        return idSet.has(sid(d));
      });
    const partIds = new Set(
      records.map(function (d) {
        return sid(d);
      })
    );
    const participateRate = (partIds.size / size) * 100;

    list.push({
      label: o.grade + '-' + o.cls,
      grade: o.grade,
      cls: o.cls,
      activeRate: activeRate,
      participateRate: participateRate,
    });
  });
  return list;
}

function renderHorizontalBarChart(domId, list, valueKey, labelSuffix) {
  const dom = document.getElementById(domId);
  if (!dom) return null;
  const sorted = list
    .slice()
    .sort(function (a, b) {
      return (a[valueKey] || 0) - (b[valueKey] || 0);
    });
  const h = Math.max(300, sorted.length * 35 + 60);
  dom.style.height = h + 'px';
  disposeChart(domId);
  if (!sorted.length || typeof echarts === 'undefined') {
    dom.innerHTML = '<p class="metric-label" style="padding:24px;">暂无班级数据</p>';
    return null;
  }
  dom.innerHTML = '';
  const names = sorted.map(function (x) {
    return x.label;
  });
  const barData = sorted.map(function (x) {
    const raw = x[valueKey];
    const v = raw == null || !Number.isFinite(Number(raw)) ? 0 : Number(Number(raw).toFixed(1));
    return {
      value: v,
      itemStyle: {
        color: classBarColorForRate(v),
        borderRadius: [0, 4, 4, 0],
      },
    };
  });
  const inst = echarts.init(dom);
  inst.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params) {
        const p = params[0];
        const v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
        return p.name + '<br/>' + labelSuffix + '：' + v + '%';
      },
    },
    grid: { left: 120, right: 64, top: 16, bottom: 24 },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%', color: '#6B7280' },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: '#374151', width: 110, overflow: 'truncate' },
      inverse: false,
    },
    series: [
      {
        type: 'bar',
        data: barData,
        barWidth: 18,
        label: {
          show: true,
          position: 'right',
          formatter: function (p) {
            const v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
            return v + '%';
          },
          color: '#374151',
        },
        animationDuration: 600,
      },
    ],
  });
  bindClassChartNavigate(inst, sorted);
  return inst;
}

function renderClassRanking() {
  const list = buildClassStatsList().map(function (x) {
    return {
      label: x.label,
      grade: x.grade,
      cls: x.cls,
      activeRate: x.activeRate,
    };
  });
  classChartInst = renderHorizontalBarChart(
    'classChart',
    list.map(function (x) {
      return { label: x.label, grade: x.grade, cls: x.cls, activeRate: x.activeRate };
    }),
    'activeRate',
    '活跃率'
  );
}

function renderSsClassRanking() {
  /* 学校驾驶舱已改为高频错题列表，保留空函数避免旧引用报错 */
}

function collectHighFreqWrongQuestions(maxCount) {
  const students = getFilteredStudents();
  const studentIds = new Set(students.map(sid).filter(Boolean));
  if (!studentIds.size) return [];

  const records = getFilteredExamDetail()
    .concat(getFilteredPracticeDetail())
    .filter(function (d) {
      return studentIds.has(sid(d)) && isExamSubmitted(d);
    });

  const paperGroups = groupBy(records, 'paper_id');
  const errors = [];

  Object.keys(paperGroups).forEach(function (paperId) {
    const paperRecords = paperGroups[paperId];
    if (!paperRecords.length) return;

    const latest = getLatestPerStudentHw(paperRecords);
    if (!latest.length) return;

    const meta = paperRecords[0];
    let totalQ = 0;
    paperRecords.forEach(function (d) {
      const tq = parseInt(d.total_questions, 10);
      if (Number.isFinite(tq) && tq > totalQ) totalQ = tq;
    });
    if (!totalQ) return;

    const paperName = String(meta.paper_name || meta['试卷名称'] || '').trim();
    const subject = rowSubject(meta);
    const doerCount = latest.length;

    for (let i = 1; i <= totalQ; i++) {
      let wrongCount = 0;
      latest.forEach(function (d) {
        if (recordHasWrongQuestionNo(paperId, d.wrong_question_ids, i)) wrongCount += 1;
      });
      if (wrongCount <= 0) continue;

      const correctRate =
        doerCount > 0 ? parseFloat((((doerCount - wrongCount) / doerCount) * 100).toFixed(1)) : 0;

      const questionZujuanId =
        typeof getPaperQuestionZujuanId === 'function'
          ? getPaperQuestionZujuanId(paperId, i)
          : String(i);
      const zujuanUrl =
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

  const limit = typeof maxCount === 'number' ? maxCount : 100;
  return errors.slice(0, limit);
}

function renderHighFreqErrors() {
  const el = document.getElementById('ssHighFreqErrors');
  const footer = document.getElementById('ssHighFreqErrorsFooter');
  if (!el) return;

  const allItems = collectHighFreqWrongQuestions(100);
  const displayCount = ssHighFreqErrorExpanded ? Math.min(allItems.length, 100) : Math.min(allItems.length, 10);
  const display = allItems.slice(0, displayCount);

  if (!display.length) {
    el.innerHTML = '<div class="high-freq-errors-empty">暂无高频错题数据</div>';
    if (footer) footer.innerHTML = '';
    return;
  }

  let html =
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
    const rateClass =
      item.correctRate >= 80 ? 'tag-success' : item.correctRate >= 60 ? 'tag-warning' : 'tag-error';
    const paperName = item.paperName || '--';
    html +=
      '<tr>' +
      '<td class="hf-cell-rank">' +
      (idx + 1) +
      '</td>' +
      '<td class="hf-cell-paper" title="' +
      escapeAttr(paperName) +
      '">' +
      escapeHtml(paperName) +
      '</td>' +
      '<td class="hf-cell-question"><a class="hf-question-link" href="' +
      escapeAttr(item.zujuanUrl) +
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
  el.innerHTML = html;

  if (footer) {
    if (allItems.length > 10) {
      footer.innerHTML =
        '<button type="button" class="btn btn-outline btn-sm" onclick="toggleSsHighFreqErrors()">' +
        (ssHighFreqErrorExpanded ? '收起' : '查看更多') +
        '</button>';
    } else {
      footer.innerHTML = '';
    }
  }
}

function toggleSsHighFreqErrors() {
  ssHighFreqErrorExpanded = !ssHighFreqErrorExpanded;
  renderHighFreqErrors();
}

function collectWeakKnowledgePoints(limit) {
  const data = getFilteredKnowledgeMastery();
  const studentIds = new Set(
    getFilteredStudents()
      .map(sid)
      .filter(Boolean)
  );
  const map = {};
  data
    .filter(function (d) {
      return studentIds.has(sid(d));
    })
    .forEach(function (d) {
      const mastered = String(d.is_mastered != null ? d.is_mastered : d['掌握状态'] || '').trim();
      if (mastered !== '未掌握') return;
      const kp = d.knowledge_point || d['知识点'] || '';
      if (!kp) return;
      if (!map[kp]) map[kp] = { name: kp, subject: rowSubject(d), count: 0 };
      map[kp].count += 1;
    });
  const sorted = Object.values(map).sort(function (a, b) {
    return b.count - a.count;
  });
  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}

const WEAK_KP_BAR_COLOR = '#8B1A1A';

function weakKpCloudColor(ratio) {
  const r = Math.max(0, Math.min(1, Number(ratio) || 0));
  if (r >= 0.72) return '#5c1010';
  if (r >= 0.48) return '#7f1d1d';
  if (r >= 0.28) return '#8B1A1A';
  if (r >= 0.12) return '#a85555';
  return '#c4a8a8';
}

function getWeakKpPanelHeight(itemCount) {
  const rows = Math.min(itemCount || 0, 20);
  if (!rows) return 320;
  return Math.max(320, rows * 30 + 48);
}

function renderWeakKnowledgeBarChart(items, panelHeight) {
  const dom = document.getElementById('ssWeakKnowledgeChart');
  if (!dom) return;
  disposeChart('ssWeakKnowledgeChart');
  if (!items.length || typeof echarts === 'undefined') {
    dom.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text-light);">暂无数据</div>';
    ssWeakBarChartInst = null;
    return;
  }

  const display = items.slice(0, 20);
  dom.innerHTML = '';
  dom.style.height =
    (panelHeight != null ? panelHeight : getWeakKpPanelHeight(items.length)) + 'px';

  const names = display.map(function (d) {
    return d.name;
  });
  const seriesData = display.map(function (d) {
    return {
      value: d.count,
      itemStyle: {
        color:
          typeof echarts !== 'undefined' && echarts.graphic
            ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#9f2929' },
                { offset: 1, color: WEAK_KP_BAR_COLOR },
              ])
            : WEAK_KP_BAR_COLOR,
        borderRadius: [0, 4, 4, 0],
      },
    };
  });

  ssWeakBarChartInst = echarts.init(dom);
  ssWeakBarChartInst.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params) {
        const p = params[0];
        if (!p) return '';
        const idx = display.length - 1 - p.dataIndex;
        const item = display[idx] || {};
        const v = typeof p.data === 'object' && p.data !== null ? p.data.value : p.data;
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
}

function renderWeakKnowledgeCloud(items, panelHeight) {
  const dom = document.getElementById('ssWeakKnowledgeCloud');
  if (!dom) return;
  disposeChart('ssWeakKnowledgeCloud');

  if (!items.length || typeof echarts === 'undefined') {
    dom.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text-light);">暂无数据</div>';
    ssWeakCloudChartInst = null;
    return;
  }

  const cloudItems = items.slice(0, 45);
  const maxCount = cloudItems[0].count || 1;
  const minCount = cloudItems[cloudItems.length - 1].count || 1;
  const span = maxCount - minCount || 1;
  const data = cloudItems.map(function (k) {
    const ratio = (k.count - minCount) / span;
    return {
      name: k.name,
      value: k.count,
      textStyle: {
        color: weakKpCloudColor(ratio),
        fontWeight: ratio >= 0.45 ? 600 : 500,
      },
    };
  });

  const h = panelHeight != null ? panelHeight : getWeakKpPanelHeight(items.length);
  dom.innerHTML = '';
  dom.style.height = h + 'px';
  ssWeakCloudChartInst = echarts.init(dom);
  ssWeakCloudChartInst.setOption({
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
}

function renderWeakKnowledge() {
  const items = collectWeakKnowledgePoints();
  if (!items.length) {
    const chartDom = document.getElementById('ssWeakKnowledgeChart');
    const cloudDom = document.getElementById('ssWeakKnowledgeCloud');
    const empty =
      '<div style="text-align:center;padding:40px;color:var(--text-light);">暂无数据</div>';
    disposeChart('ssWeakKnowledgeChart');
    disposeChart('ssWeakKnowledgeCloud');
    ssWeakBarChartInst = null;
    ssWeakCloudChartInst = null;
    if (chartDom) chartDom.innerHTML = empty;
    if (cloudDom) cloudDom.innerHTML = empty;
    return;
  }
  const panelHeight = getWeakKpPanelHeight(items.length);
  renderWeakKnowledgeBarChart(items, panelHeight);
  renderWeakKnowledgeCloud(items, panelHeight);
}

function buildCoverageItemsForAi() {
  const total = getFilteredStudents().length || 1;
  const studentIds = new Set(
    getFilteredStudents()
      .map(sid)
      .filter(Boolean)
  );
  function cntUsage(pred) {
    const set = new Set();
    getFilteredUsageSummary().forEach(function (row) {
      if (!pred(row)) return;
      const id = sid(row);
      if (id) set.add(id);
    });
    return (set.size / total) * 100;
  }
  const examSet = new Set();
  getFilteredExamDetail().forEach(function (row) {
    if (!studentIds.has(sid(row))) return;
    const scene = row['考试场景'] != null ? row['考试场景'] : row.scene;
    if (!isExamScene(scene)) return;
    const id = sid(row);
    if (id) examSet.add(id);
  });
  const pracSet = new Set();
  getFilteredPracticeDetail().forEach(function (row) {
    if (!studentIds.has(sid(row))) return;
    const scene = row['练习场景'] != null ? row['练习场景'] : row.scene;
    if (!isPracticeScene(scene)) return;
    const id = sid(row);
    if (id) pracSet.add(id);
  });
  return [
    { name: '查资料', rate: cntUsage(function (r) { const v = Number(r.view_count != null ? r.view_count : r['浏览次数']); return Number.isFinite(v) && v > 0; }) },
    { name: '下载', rate: cntUsage(function (r) { const v = Number(r.download_count != null ? r.download_count : r['下载次数']); return Number.isFinite(v) && v > 0; }) },
    { name: '刷卷', rate: (examSet.size / total) * 100 },
    { name: '练习', rate: (pracSet.size / total) * 100 },
    { name: '看视频', rate: cntUsage(function (r) { const v = Number(r.watch_count != null ? r.watch_count : r['观看次数']); return Number.isFinite(v) && v > 0; }) },
    { name: '拍搜', rate: cntUsage(function (r) { const v = Number(r.photo_search_count != null ? r.photo_search_count : r['拍搜次数']); return Number.isFinite(v) && v > 0; }) },
    { name: '伴学', rate: cntUsage(function (r) { const v = Number(r.companion_visit_count != null ? r.companion_visit_count : r['伴学次数']); return Number.isFinite(v) && v > 0; }) },
  ];
}

function renderAiAnalysis() {
  const el = document.getElementById('aiAnalysis');
  const total = getFilteredStudents().length;
  const active = countActiveStudentsFromDaily();
  const usageCnt = countUsageStudents();
  const activeRate = total ? (active / total) * 100 : 0;
  const usageRate = total ? (usageCnt / total) * 100 : 0;
  const avgMin = total
    ? Math.round(
        calcSessionLearningDurationMinutes({
          dailyActiveRecords: getFilteredDailyActive(),
        }) / total
      )
    : 0;

  const covItems = buildCoverageItemsForAi();
  const byName = {};
  covItems.forEach(function (x) {
    byName[x.name] = x.rate;
  });

  const gradeRates = getTableGradeList().map(function (g) {
    return { grade: g, rate: gradeMetrics(g).activeRate };
  });
  const avgGradeActive =
    gradeRates.length > 0
      ? gradeRates.reduce(function (s, x) {
          return s + x.rate;
        }, 0) / gradeRates.length
      : 0;

  let lowestGrade = null;
  let lowestGr = Infinity;
  gradeRates.forEach(function (x) {
    if (x.rate < lowestGr) {
      lowestGr = x.rate;
      lowestGrade = x;
    }
  });
  const spreadOk =
    gradeRates.length >= 2 &&
    gradeRates.some(function (x) {
      return Math.abs(x.rate - avgGradeActive) >= 5;
    });

  const unused = total - active;
  const unusedRate = total ? (unused / total) * 100 : 0;

  let lowestFeat = null;
  let lowestFr = Infinity;
  covItems.forEach(function (x) {
    if (x.rate < lowestFr) {
      lowestFr = x.rate;
      lowestFeat = x;
    }
  });

  let html = '<div class="cockpit-ai-analysis">';
  html +=
    '<div class="ai-section">' +
    '<div class="ai-section-title">全校使用概述</div>' +
    '<div class="ai-text">本周期全校活跃率<span class="highlight">' +
    activeRate.toFixed(1) +
    '%</span>，共<span class="highlight">' +
    active +
    '</span>名学生在本周期有活跃记录；其中<span class="highlight">' +
    usageCnt +
    '</span>名学生使用过至少一项功能（使用率<span class="highlight">' +
    usageRate.toFixed(1) +
    '%</span>）。人均学习时长约<span class="highlight">' +
    avgMin +
    ' 分钟</span>。刷卷覆盖率<span class="highlight">' +
    (byName['刷卷'] != null ? byName['刷卷'].toFixed(1) : '0') +
    '%</span>，专项练习覆盖率<span class="highlight">' +
    (byName['练习'] != null ? byName['练习'].toFixed(1) : '0') +
    '%</span>，视频观看率<span class="highlight">' +
    (byName['看视频'] != null ? byName['看视频'].toFixed(1) : '0') +
    '%</span>。</div></div>';

  const warnLi = [];
  if (spreadOk && lowestGrade && gradeRates.length) {
    warnLi.push(
      '<li><span class="highlight">' +
        escapeHtml(lowestGrade.grade) +
        '</span>年级活跃率为<span class="highlight">' +
        lowestGrade.rate.toFixed(1) +
        '%</span>，与全校平均水平差距较大，需重点关注。</li>'
    );
  }
  if (unused > 0) {
    warnLi.push(
      '<li>全校有<span class="highlight">' +
        unused +
        '</span>名学生（<span class="highlight">' +
        unusedRate.toFixed(1) +
        '%</span>）本周期无活跃记录。</li>'
    );
  }
  if (lowestFeat) {
    warnLi.push(
      '<li><span class="highlight">' +
        escapeHtml(lowestFeat.name) +
        '</span>功能覆盖率仅<span class="highlight">' +
        lowestFeat.rate.toFixed(1) +
        '%</span>，相对偏低。</li>'
    );
  }
  if (activeRate < 70 && total > 0) {
    warnLi.push(
      '<li>全校整体活跃率为<span class="highlight">' +
        activeRate.toFixed(1) +
        '%</span>，低于理想区间，建议结合年级与班级数据排查原因。</li>'
    );
  }
  if (usageRate < 60 && total > 0) {
    warnLi.push(
      '<li>功能使用率<span class="highlight">' +
        usageRate.toFixed(1) +
        '%</span>，仍有较多学生未使用核心学习功能。</li>'
    );
  }
  if (warnLi.length < 2) {
    warnLi.push(
      '<li>各年级活跃率整体相对均衡，建议继续保持数据跟踪，及时发现波动。</li>'
    );
  }
  if (warnLi.length < 2) {
    warnLi.push('<li>建议结合班级管理与学生管理模块，对重点班级做跟进。</li>');
  }

  html += '<div class="ai-section"><div class="ai-section-title">重点关注</div><ul class="ai-text">';
  html += warnLi.slice(0, 3).join('');
  html += '</ul></div>';

  const sug = [];
  if (spreadOk && lowestGrade) {
    sug.push(
      '<li>针对<span class="highlight">' +
        escapeHtml(lowestGrade.grade) +
        '</span>年级组织产品使用培训与任务布置，缩小与全校差距。</li>'
    );
  }
  if (unused > 0) {
    sug.push('<li>对未活跃学生名单进行推送提醒，可由班主任配合完成首次登录与功能体验。</li>');
  }
  if (lowestFeat) {
    sug.push(
      '<li>在教研活动中重点演示<span class="highlight">' +
        escapeHtml(lowestFeat.name) +
        '</span>功能的使用场景，提升师生认知度。</li>'
    );
  }
  sug.push('<li>建立周度查看驾驶舱数据的习惯，将活跃率、使用率纳入年级常规管理指标。</li>');
  sug.push('<li>结合「班级管理」中的薄弱知识点，向对应班级定向推荐练习与视频资源。</li>');
  sug.push('<li>鼓励教师将刷卷、专项练习纳入课后巩固环节，逐步提高刷卷与练习覆盖率。</li>');

  html += '<div class="ai-section"><div class="ai-section-title">教学建议</div><ol class="ai-text">';
  html += sug.slice(0, 3).join('');
  html += '</ol></div>';

  html += '</div>';
  el.innerHTML = html;
}

async function init() {
  if (typeof ensureSchoolBrands === 'function') {
    await ensureSchoolBrands();
  }
  if (!initDashboardLayout('cockpit')) return;

  if (AppState.isTeacher()) {
    window.location.href = 'diagnosis.html';
    return;
  }
  if (!AppState.isSchoolAdmin()) {
    window.location.href = 'diagnosis.html';
    return;
  }

  const loading = document.getElementById('pageLoading');
  const body = document.getElementById('pageBody');

  try {
    const [students, dailyActive, usageSummary, materialDetail, videoDetail, examDetail, practiceDetail, knowledgeMastery, paperQuestions] =
      await Promise.all([
        DataLoader.students(),
        DataLoader.dailyActive(),
        DataLoader.usageSummary(),
        DataLoader.materialDetail(),
        DataLoader.videoDetail(),
        DataLoader.examDetail(),
        DataLoader.practiceDetail(),
        DataLoader.knowledgeMastery(),
        DataLoader.paperQuestions(),
      ]);

    if (typeof setPaperQuestionMap === 'function') {
      setPaperQuestionMap(paperQuestions);
    }

    const school = AppState.getSchool();
    allStudents = filterBySchool(students, school);
    const studentIds = allStudents.map(sid).filter(Boolean);
    const idSet = new Set(studentIds);

    allDailyActive = normalizeDailyActiveRows(dailyActive).filter(function (d) {
      return idSet.has(rowDailyActiveUserId(d));
    });
    allUsageSummary = usageSummary.filter(function (u) {
      return idSet.has(sid(u));
    });
    allMaterialDetail = materialDetail.filter(function (d) {
      return idSet.has(sid(d));
    });
    allVideoDetail = videoDetail.filter(function (d) {
      return idSet.has(sid(d));
    });
    allExamDetail = applyTenantToRows(
      examDetail.filter(function (e) {
        return idSet.has(sid(e));
      }),
      school
    );
    allPracticeDetail = applyTenantToRows(
      practiceDetail.filter(function (p) {
        return idSet.has(sid(p));
      }),
      school
    );
    allKnowledgeMastery = applyTenantToRows(
      knowledgeMastery.filter(function (k) {
        return idSet.has(sid(k));
      }),
      school
    );

    gradeList = uniqGrades(allStudents);
    subjectList = buildSubjectList();

    if (loading) loading.style.display = 'none';
    if (body) body.style.display = 'block';

    fillFilters();
    renderCoreMetrics();
    renderLearningPanel();

    setTimeout(function () {
      if (ssTrendChartInst) ssTrendChartInst.resize();
      if (ssSubjectChartInst) ssSubjectChartInst.resize();
      if (ssWeakBarChartInst) ssWeakBarChartInst.resize();
      if (ssWeakCloudChartInst) ssWeakCloudChartInst.resize();
    }, 120);

    if (!window.__cockpitResizeBound) {
      window.__cockpitResizeBound = true;
      window.addEventListener(
        'resize',
        function () {
          if (ssTrendChartInst) ssTrendChartInst.resize();
          if (ssSubjectChartInst) ssSubjectChartInst.resize();
          if (ssWeakBarChartInst) ssWeakBarChartInst.resize();
          if (ssWeakCloudChartInst) ssWeakCloudChartInst.resize();
        },
        { passive: true }
      );
    }
  } catch (e) {
    console.error(e);
    if (loading) {
      loading.textContent = '数据加载失败，请刷新重试或检查控制台。';
    }
  }
}

window.addEventListener('DOMContentLoaded', init);

window.renderClassRanking = renderClassRanking;
window.onGlobalFilterChange = onGlobalFilterChange;
window.toggleSsHighFreqErrors = toggleSsHighFreqErrors;
