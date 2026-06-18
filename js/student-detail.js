/**
 * 学生详情页 — 单个学生完整学习画像
 */
(function () {
  'use strict';

  var studentId = '';
  var studentInfo = null;
  var studentDailyActive = null;
  var studentExams = [];
  var studentPractices = [];
  var studentMaterials = [];
  var studentVideos = [];
  var studentKnowledge = [];
  var cutoffDate = '';

  var classStudents = [];
  var classExamDetail = [];
  var classPracticeDetail = [];

  var detailSubjectFilter = '';
  var knowledgeSubjectFilter = '';

  var EMPTY_HINT =
    '<div style="text-align:center;padding:40px;color:var(--text-light);">';

  function sid(row) {
    return rowStudentId(row);
  }

  function sname(row) {
    return rowStudentName(row);
  }

  function rowCampus(row) {
    if (!row) return '';
    return String(row.campus || row['校区'] || row['所属校区'] || '').trim();
  }

  function normalizeStudent(raw) {
    if (!raw) return null;
    return {
      student_id: sid(raw),
      student_name: sname(raw),
      school_name: rowSchoolName(raw),
      campus: rowCampus(raw),
      grade: rowGradeVal(raw),
      class_name: rowClassName(raw),
      _raw: raw
    };
  }

  function pickTime(row, keys) {
    if (!row) return '';
    var i;
    for (i = 0; i < keys.length; i++) {
      if (row[keys[i]]) return String(row[keys[i]]).trim();
    }
    return '';
  }

  function pickSubject(row) {
    return rowSubject(row) || row.subject || row['学科'] || '';
  }

  async function init() {
    if (typeof ensureSchoolBrands === 'function') {
      await ensureSchoolBrands();
    }
    if (!initDashboardLayout('diagnosis')) return;

    studentId = new URLSearchParams(window.location.search).get('id');
    if (!studentId) {
      alert('缺少学生ID');
      window.location.href = 'diagnosis.html';
      return;
    }

    cutoffDate = AppState.getCutoffDate();

    var results = await Promise.all([
      DataLoader.students(),
      DataLoader.dailyActive(),
      DataLoader.materialDetail(),
      DataLoader.videoDetail(),
      DataLoader.examDetail(),
      DataLoader.practiceDetail(),
      DataLoader.knowledgeMastery()
    ]);

    var students = filterByPermission(results[0])
      .map(normalizeStudent)
      .filter(function (s) {
      return s && s.student_id;
    });

    var dailyActive = results[1];
    var materialDetail = results[2];
    var videoDetail = results[3];
    var examDetail = results[4];
    var practiceDetail = results[5];
    var knowledgeMastery = results[6];

    studentInfo = students.find(function (s) {
      return s.student_id === studentId;
    });
    if (!studentInfo) {
      alert('未找到该学生');
      window.location.href = 'diagnosis.html';
      return;
    }

    studentDailyActive = normalizeDailyActiveRows(dailyActive || []).filter(function (d) {
      return rowDailyActiveUserId(d) === studentId;
    });

    studentMaterials = filterByCutoffDate(
      (materialDetail || []).filter(function (d) {
        return sid(d) === studentId;
      }),
      cutoffDate,
      'time'
    );
    studentVideos = filterByCutoffDate(
      (videoDetail || []).filter(function (d) {
        return sid(d) === studentId;
      }),
      cutoffDate,
      'time'
    );
    var tenantSchool = AppState.getSchool();
    studentExams = applyTenantToRows(
      filterByCutoffDate(
        (examDetail || []).filter(function (d) {
          return sid(d) === studentId;
        }),
        cutoffDate,
        'submit_time'
      ),
      tenantSchool
    );
    studentPractices = applyTenantToRows(
      filterByCutoffDate(
        (practiceDetail || []).filter(function (d) {
          return sid(d) === studentId;
        }),
        cutoffDate,
        'submit_time'
      ),
      tenantSchool
    );
    studentKnowledge = applyTenantToRows(
      filterByCutoffDate(
        (knowledgeMastery || []).filter(function (d) {
          return sid(d) === studentId;
        }),
        cutoffDate,
        'judge_time'
      ),
      tenantSchool
    );

    var schoolName = studentInfo.school_name;
    var grade = studentInfo.grade;
    var className = studentInfo.class_name;
    classStudents = students.filter(function (s) {
      return (
        s.school_name === schoolName &&
        s.grade === grade &&
        s.class_name === className
      );
    });
    var classIds = classStudents.map(function (s) {
      return s.student_id;
    });
    classExamDetail = applyTenantToRows(
      filterByCutoffDate(
        (examDetail || []).filter(function (d) {
          return classIds.indexOf(sid(d)) >= 0;
        }),
        cutoffDate,
        'submit_time'
      ),
      tenantSchool
    );
    classPracticeDetail = applyTenantToRows(
      filterByCutoffDate(
        (practiceDetail || []).filter(function (d) {
          return classIds.indexOf(sid(d)) >= 0;
        }),
        cutoffDate,
        'submit_time'
      ),
      tenantSchool
    );

    if (typeof HomeworkManager !== 'undefined') {
      HomeworkManager.initDemoData(examDetail, practiceDetail, results[0]);
    }

    initSubjectFilters();
    renderStudentInfo();
    renderMetricCards();
    renderSubjectChart();
    renderLearningContent();
    renderExamRecords();
    renderKnowledgeSection();
    renderAIAnalysis();

    var c1 = document.getElementById('detailTabContent1');
    if (c1) c1.style.display = 'none';
  }

  window.addEventListener('DOMContentLoaded', init);

  /* ===== 学生信息卡片 ===== */
  function renderStudentInfo() {
    var activeDays = calcActiveDaysForUser(
      studentDailyActive,
      studentId,
      DATA_PERIOD_START,
      cutoffDate
    );
    var allRecords = studentExams.concat(studentPractices);
    var combinedRate = calcCorrectRate(allRecords);
    var totalDays = getCutoffTotalDays(cutoffDate);
    var status = getStatusTag(activeDays, combinedRate, totalDays);

    var campusLine = studentInfo.campus
      ? '<div class="student-meta">' + escapeHtml(studentInfo.campus) + '</div>'
      : '';

    document.getElementById('studentInfo').innerHTML =
      '<div class="student-name">' +
      escapeHtml(studentInfo.student_name) +
      '</div>' +
      '<div class="student-meta">' +
      escapeHtml(studentInfo.school_name) +
      '</div>' +
      campusLine +
      '<div class="student-meta">' +
      escapeHtml(studentInfo.grade + ' ' + studentInfo.class_name) +
      '</div>' +
      '<span class="tag ' +
      status.class +
      '">' +
      escapeHtml(status.text) +
      '</span>';
  }

  /* ===== 模块1：学习概览 ===== */
  function renderMetricCards() {
    var activeDays = calcActiveDaysForUser(
      studentDailyActive,
      studentId,
      DATA_PERIOD_START,
      cutoffDate
    );
    var examCount = studentExams.length;
    var examRate = calcCorrectRate(studentExams);
    var practiceCount = studentPractices.length;
    var practiceRate = calcCorrectRate(studentPractices);

    document.getElementById('metricCards').innerHTML =
      metricStatCard('学习天数', activeDays, '天') +
      metricStatCard('刷卷次数', examCount, '次') +
      metricStatCard(
        '刷卷正确率',
        examRate !== null ? (examRate * 100).toFixed(1) + '%' : '--',
        '',
        getRateColor(examRate)
      ) +
      metricStatCard('练习次数', practiceCount, '次') +
      metricStatCard(
        '练习正确率',
        practiceRate !== null ? (practiceRate * 100).toFixed(1) + '%' : '--',
        '',
        getRateColor(practiceRate)
      );
  }

  function metricStatCard(label, value, unit, color) {
    var style = color ? ' style="color:' + color + '"' : '';
    var unitHtml = unit
      ? '<span style="font-size:14px;font-weight:500;">' + unit + '</span>'
      : '';
    return (
      '<div class="metric-card metric-card--stat">' +
      '<div class="metric-value"' +
      style +
      '>' +
      value +
      unitHtml +
      '</div>' +
      '<div class="metric-label">' +
      escapeHtml(label) +
      '</div>' +
      '</div>'
    );
  }

  /* ===== 模块2：学科学习画像 ===== */
  function renderSubjectChart() {
    var allRecords = studentMaterials
      .concat(studentVideos)
      .concat(studentExams)
      .concat(studentPractices);

    var subjectMap = {};
    allRecords.forEach(function (d) {
      var sub = pickSubject(d);
      if (!sub) return;
      if (!subjectMap[sub]) {
        subjectMap[sub] = { name: sub, count: 0, exams: [], practices: [] };
      }
      subjectMap[sub].count++;
    });

    studentExams.forEach(function (d) {
      var sub = pickSubject(d);
      if (sub && subjectMap[sub]) subjectMap[sub].exams.push(d);
    });
    studentPractices.forEach(function (d) {
      var sub = pickSubject(d);
      if (sub && subjectMap[sub]) subjectMap[sub].practices.push(d);
    });

    var data = Object.keys(subjectMap)
      .map(function (k) {
        var s = subjectMap[k];
        var allDo = s.exams.concat(s.practices);
        return {
          name: s.name,
          count: s.count,
          rate: calcCorrectRate(allDo)
        };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });

    var chartDom = document.getElementById('subjectChart');
    if (!chartDom) return;

    if (data.length === 0) {
      chartDom.innerHTML = EMPTY_HINT + '暂无学习数据</div>';
      return;
    }

    var chart = echarts.getInstanceByDom(chartDom);
    if (chart) chart.dispose();
    chart = echarts.init(chartDom);

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          var tip = params[0].name + '<br/>';
          params.forEach(function (p) {
            tip +=
              p.seriesName +
              '：' +
              p.value +
              (p.seriesName === '正确率' ? '%' : '次') +
              '<br/>';
          });
          return tip;
        }
      },
      legend: { data: ['学习次数', '正确率'], top: 10 },
      grid: { left: 60, right: 60, top: 50, bottom: 30 },
      xAxis: {
        type: 'category',
        data: data.map(function (d) {
          return d.name;
        }),
        axisLabel: { fontSize: 12 }
      },
      yAxis: [
        { type: 'value', name: '学习次数', axisLabel: { fontSize: 11 } },
        {
          type: 'value',
          name: '正确率',
          max: 100,
          axisLabel: { formatter: '{value}%', fontSize: 11 }
        }
      ],
      series: [
        {
          name: '学习次数',
          type: 'bar',
          data: data.map(function (d) {
            return d.count;
          }),
          barWidth: 30,
          itemStyle: { color: '#8B1A1A', borderRadius: [4, 4, 0, 0] }
        },
        {
          name: '正确率',
          type: 'line',
          yAxisIndex: 1,
          data: data.map(function (d) {
            return d.rate !== null
              ? parseFloat((d.rate * 100).toFixed(1))
              : null;
          }),
          lineStyle: { color: '#DAA520', width: 2 },
          itemStyle: { color: '#DAA520' },
          symbol: 'circle',
          symbolSize: 8
        }
      ]
    });

    window.addEventListener('resize', function () {
      chart.resize();
    });
  }

  /* ===== 模块3：学习明细 ===== */
  function collectStudentSubjects() {
    var set = new Set();
    function addFrom(arr) {
      (arr || []).forEach(function (d) {
        var s = pickSubject(d);
        if (s) set.add(s);
      });
    }
    addFrom(studentMaterials);
    addFrom(studentVideos);
    addFrom(studentExams);
    addFrom(studentPractices);
    addFrom(studentKnowledge);
    return Array.from(set).sort(function (a, b) {
      return a.localeCompare(b, 'zh-CN');
    });
  }

  function fillSubjectSelect(selectEl, subjects, lockedSubject) {
    if (!selectEl) return '';
    if (lockedSubject) {
      selectEl.innerHTML =
        '<option value="' +
        escapeHtml(lockedSubject) +
        '">' +
        escapeHtml(lockedSubject) +
        '</option>';
      selectEl.value = lockedSubject;
      selectEl.disabled = true;
      return lockedSubject;
    }
    selectEl.innerHTML =
      '<option value="">全部学科</option>' +
      subjects
        .map(function (s) {
          return (
            '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>'
          );
        })
        .join('');
    selectEl.disabled = false;
    return '';
  }

  function initSubjectFilters() {
    var subjects = collectStudentSubjects();
    var locked =
      studentInfo && shouldLockSubject(studentInfo.class_name)
        ? AppState.getSubject()
        : '';
    detailSubjectFilter = fillSubjectSelect(
      document.getElementById('detailSubjectSelect'),
      subjects,
      locked
    );
    knowledgeSubjectFilter = fillSubjectSelect(
      document.getElementById('knowledgeSubjectSelect'),
      subjects,
      locked
    );
  }

  function onDetailSubjectChange() {
    var sel = document.getElementById('detailSubjectSelect');
    detailSubjectFilter = sel ? sel.value : '';
    renderLearningContent();
    renderExamRecords();
  }

  function onKnowledgeSubjectChange() {
    var sel = document.getElementById('knowledgeSubjectSelect');
    knowledgeSubjectFilter = sel ? sel.value : '';
    renderKnowledgeSection();
  }

  function matchSubjectFilter(record, filterVal) {
    if (!filterVal) return true;
    return pickSubject(record) === filterVal;
  }

  function switchDetailTab(index) {
    document.querySelectorAll('#detailTabs .tab').forEach(function (t, i) {
      t.classList.toggle('active', i === index);
    });
    var c0 = document.getElementById('detailTabContent0');
    var c1 = document.getElementById('detailTabContent1');
    if (c0) {
      c0.classList.toggle('active', index === 0);
      c0.style.display = index === 0 ? 'block' : 'none';
      c0.hidden = index !== 0;
    }
    if (c1) {
      c1.classList.toggle('active', index === 1);
      c1.style.display = index === 1 ? 'block' : 'none';
      c1.hidden = index !== 1;
    }
  }
  window.switchDetailTab = switchDetailTab;
  window.onDetailSubjectChange = onDetailSubjectChange;
  window.onKnowledgeSubjectChange = onKnowledgeSubjectChange;

  function renderLearningContent() {
    var allContent = studentMaterials
      .map(function (d) {
        return {
          time: pickTime(d, ['time', 'dt', '查看时间', '学习时间']),
          name: rowMaterialTitle(d),
          type: '资料',
          subject: pickSubject(d),
          chapter: rowCatalogNames(d),
        };
      })
      .concat(
        studentVideos.map(function (d) {
          return {
            time: pickTime(d, ['time', 'dt', '观看时间', '学习时间']),
            name: rowMaterialTitle(d),
            type: '视频',
            subject: pickSubject(d),
            chapter: rowCatalogNames(d),
          };
        })
      )
      .sort(function (a, b) {
        return (b.time || '').localeCompare(a.time || '');
      });

    if (detailSubjectFilter) {
      allContent = allContent.filter(function (c) {
        return c.subject === detailSubjectFilter;
      });
    }

    var el = document.getElementById('detailTabContent0');
    if (!el) return;

    if (allContent.length === 0) {
      el.innerHTML =
        EMPTY_HINT +
        (detailSubjectFilter
          ? '该学科暂无学习内容记录'
          : '暂无学习内容记录') +
        '</div>';
      return;
    }

    var html =
      '<table class="data-table"><thead><tr><th>时间</th><th>内容名称</th><th>类型</th><th>学科</th><th>章节</th></tr></thead><tbody>';
    allContent.slice(0, 20).forEach(function (c) {
      html +=
        '<tr>' +
        '<td style="font-size:12px;">' +
        formatDate(c.time) +
        '</td>' +
        '<td>' +
        escapeHtml(c.name) +
        '</td>' +
        '<td><span class="tag tag-gray">' +
        escapeHtml(c.type) +
        '</span></td>' +
        '<td>' +
        escapeHtml(c.subject || '--') +
        '</td>' +
        '<td style="font-size:12px;color:var(--text-secondary);">' +
        escapeHtml(c.chapter || '--') +
        '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    if (allContent.length > 20) {
      html +=
        '<div style="text-align:center;padding:12px;color:var(--text-light);font-size:13px;">仅展示最近 20 条记录</div>';
    }
    el.innerHTML = html;
  }

  function getRecordSource(record) {
    if (
      typeof HomeworkManager !== 'undefined' &&
      studentInfo &&
      HomeworkManager.isHomeworkRecord(
        studentInfo.grade,
        studentInfo.class_name,
        record
      )
    ) {
      return { label: '作业', tagClass: 'tag-source--homework' };
    }
    return { label: '自主学习', tagClass: 'tag-source--self' };
  }

  function renderExamRecords() {
    var allRecords = studentExams
      .map(function (d) {
        var copy = {};
        Object.keys(d).forEach(function (k) {
          copy[k] = d[k];
        });
        copy.type = '刷卷';
        return copy;
      })
      .concat(
        studentPractices.map(function (d) {
          var copy = {};
          Object.keys(d).forEach(function (k) {
            copy[k] = d[k];
          });
          copy.type = '练习';
          return copy;
        })
      )
      .sort(function (a, b) {
        return (b.submit_time || '').localeCompare(a.submit_time || '');
      });

    if (detailSubjectFilter) {
      allRecords = allRecords.filter(function (d) {
        return matchSubjectFilter(d, detailSubjectFilter);
      });
    }

    var el = document.getElementById('detailTabContent1');
    if (!el) return;

    if (allRecords.length === 0) {
      el.innerHTML =
        EMPTY_HINT +
        (detailSubjectFilter ? '该学科暂无做题记录' : '暂无做题记录') +
        '</div>';
      return;
    }

    window._studentRecordMeta = {};

    var html =
      '<table class="data-table"><thead><tr><th></th><th>时间</th><th>名称</th><th>来源</th><th>形式</th><th>学科</th><th>总题数</th><th>错题数</th><th>正确率</th></tr></thead><tbody>';
    allRecords.forEach(function (d, idx) {
      var rate = parseFloat(d.correct_rate) || 0;
      var rateStr = (rate * 100).toFixed(1) + '%';
      var paperName =
        d.paper_name || d['试卷名称'] || d['练习名称'] || '';
      var source = getRecordSource(d);
      html +=
        '<tr>' +
        '<td><span class="expand-btn" onclick="toggleExpand(\'record-' +
        idx +
        '\')">展开</span></td>' +
        '<td style="font-size:12px;">' +
        formatDate(d.submit_time) +
        '</td>' +
        '<td>' +
        escapeHtml(paperName) +
        '</td>' +
        '<td><span class="tag ' +
        source.tagClass +
        '">' +
        escapeHtml(source.label) +
        '</span></td>' +
        '<td><span class="tag tag-gray">' +
        escapeHtml(d.type) +
        '</span></td>' +
        '<td>' +
        escapeHtml(pickSubject(d) || '--') +
        '</td>' +
        '<td>' +
        (d.total_questions || '--') +
        '</td>' +
        '<td style="color:var(--error);">' +
        (d.wrong_count || 0) +
        '</td>' +
        '<td style="color:' +
        getRateColor(rate) +
        ';font-weight:600;">' +
        rateStr +
        '</td>' +
        '</tr>' +
        '<tr class="sub-table-row" id="record-' +
        idx +
        '">' +
        '<td colspan="9">' +
        '<div style="padding:12px;background:var(--bg);border-radius:8px;">' +
        renderQuestionDetail(d, idx) +
        '</div>' +
        '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function buildRecordQuestionMeta(record) {
    return {
      paper_name:
        record.paper_name || record['试卷名称'] || record['练习名称'] || '',
      subject: pickSubject(record),
      chapter: record.chapter || record['章节'] || '',
      knowledge_point: record.knowledge_point || record['知识点'] || '',
    };
  }

  function viewStudentQuestion(recordIdx, questionNo) {
    var meta =
      (window._studentRecordMeta && window._studentRecordMeta[recordIdx]) || {};
    openQuestionModal(meta, questionNo);
  }

  function renderQuestionDetail(record, recordIdx) {
    var totalQ = parseInt(record.total_questions, 10) || 0;
    if (totalQ === 0) {
      return '<span style="color:var(--text-light);">暂无题目详情</span>';
    }

    window._studentRecordMeta = window._studentRecordMeta || {};
    window._studentRecordMeta[recordIdx] = buildRecordQuestionMeta(record);

    var paperId = String(record.paper_id != null ? record.paper_id : '');
    var html = '<div class="question-num-grid">';
    var i;
    for (i = 1; i <= totalQ; i++) {
      var isWrong =
        typeof recordHasWrongQuestionNo === 'function'
          ? recordHasWrongQuestionNo(paperId, record.wrong_question_ids, i)
          : (record.wrong_question_ids || '')
              .toString()
              .split(',')
              .map(function (s) {
                return s.trim();
              })
              .indexOf(String(i)) >= 0;
      if (isWrong) {
        html +=
          '<button type="button" class="question-num question-num--wrong" onclick="viewStudentQuestion(' +
          recordIdx +
          ', ' +
          i +
          ')" title="查看原题">' +
          i +
          '</button>';
      } else {
        html += '<div class="question-num question-num--right">' + i + '</div>';
      }
    }
    html += '</div>';
    html +=
      '<div style="margin-top:8px;font-size:11px;color:var(--text-light);">绿色为正确，红色为错误' +
      (wrongIds.length > 0 ? '；点击红色题号可查看原题' : '') +
      '</div>';
    return html;
  }

  /* ===== 模块4：知识点掌握 ===== */
  function getLatestKnowledgeMap(knowledgeRows) {
    var latestMap = {};
    (knowledgeRows || studentKnowledge).forEach(function (d) {
      var key = d.knowledge_point || d['知识点'];
      if (!key) return;
      if (
        !latestMap[key] ||
        (d.judge_time || '') > (latestMap[key].judge_time || '')
      ) {
        latestMap[key] = d;
      }
    });
    return latestMap;
  }

  function buildStudentPaperNameMap() {
    var map = {};
    studentExams.concat(studentPractices).forEach(function (d) {
      var pid = d.paper_id != null ? String(d.paper_id) : '';
      if (!pid || map[pid]) return;
      var name = d.paper_name || d['试卷名称'] || d['练习名称'] || '';
      if (name) map[pid] = name;
    });
    return map;
  }

  function renderKnowledgeSection() {
    var summaryEl = document.getElementById('knowledgeSummary');
    var tableEl = document.getElementById('knowledgeTable');

    if (studentKnowledge.length === 0) {
      if (summaryEl) summaryEl.innerHTML = '';
      if (tableEl) {
        tableEl.innerHTML = EMPTY_HINT + '暂无知识点数据</div>';
      }
      return;
    }

    var knowledgeData = studentKnowledge;
    if (knowledgeSubjectFilter) {
      knowledgeData = studentKnowledge.filter(function (d) {
        return matchSubjectFilter(d, knowledgeSubjectFilter);
      });
    }

    if (!knowledgeData.length) {
      if (summaryEl) summaryEl.innerHTML = '';
      if (tableEl) {
        tableEl.innerHTML = EMPTY_HINT + '该学科暂无知识点数据</div>';
      }
      return;
    }

    var latestMap = getLatestKnowledgeMap(knowledgeData);
    var paperNameMap = buildStudentPaperNameMap();
    var kpList = Object.keys(latestMap).map(function (k) {
      return latestMap[k];
    });

    var total = kpList.length;
    var mastered = kpList.filter(function (d) {
      return d.is_mastered === '已掌握';
    }).length;
    var notMastered = total - mastered;
    var rate = total > 0 ? mastered / total : null;

    if (summaryEl) {
      summaryEl.innerHTML =
        metricStatCard('涉及知识点', total, '') +
        metricStatCard('已掌握', mastered, '', 'var(--success)') +
        metricStatCard('未掌握', notMastered, '', 'var(--error)') +
        metricStatCard(
          '掌握率',
          rate !== null ? (rate * 100).toFixed(1) + '%' : '--',
          '',
          getRateColor(rate)
        );
    }

    var sorted = kpList.slice().sort(function (a, b) {
      if (a.is_mastered === '未掌握' && b.is_mastered !== '未掌握') return -1;
      if (a.is_mastered !== '未掌握' && b.is_mastered === '未掌握') return 1;
      return 0;
    });

    var html =
      '<table class="data-table"><thead><tr><th>知识点</th><th>学科</th><th>章节</th><th>掌握状态</th><th>来源</th></tr></thead><tbody>';
    sorted.forEach(function (d) {
      var kp = d.knowledge_point || d['知识点'] || '';
      var tagClass =
        d.is_mastered === '已掌握' ? 'tag-success' : 'tag-error';
      html +=
        '<tr>' +
        '<td style="font-weight:500;">' +
        escapeHtml(kp) +
        '</td>' +
        '<td>' +
        escapeHtml(pickSubject(d) || '--') +
        '</td>' +
        '<td style="font-size:12px;color:var(--text-secondary);">' +
        escapeHtml(d.chapter || d['章节'] || '--') +
        '</td>' +
        '<td><span class="tag ' +
        tagClass +
        '">' +
        escapeHtml(d.is_mastered || '--') +
        '</span></td>' +
        '<td style="font-size:12px;">' +
        escapeHtml(
          paperNameMap[String(d.paper_id != null ? d.paper_id : '')] || '--'
        ) +
        '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    if (tableEl) tableEl.innerHTML = html;
  }

  /* ===== 模块5：AI 学情分析 ===== */
  function renderAIAnalysis() {
    var activeDays = calcActiveDaysForUser(
      studentDailyActive,
      studentId,
      DATA_PERIOD_START,
      cutoffDate
    );
    var totalDays = getCutoffTotalDays(cutoffDate);
    var activePercent =
      totalDays > 0 ? ((activeDays / totalDays) * 100).toFixed(1) : '0.0';

    var examCount = studentExams.length;
    var examRate = calcCorrectRate(studentExams);
    var practiceCount = studentPractices.length;
    var practiceRate = calcCorrectRate(studentPractices);
    var materialCount = studentMaterials.length;
    var videoCount = studentVideos.length;

    var classSize = classStudents.length || 1;
    var classAvgExamCount = classExamDetail.length / classSize;
    var classAvgPracticeCount = classPracticeDetail.length / classSize;

    function compareText(value, avg) {
      if (!avg) return '';
      if (value > avg * 1.2) return '，高于班级平均水平';
      if (value >= avg * 0.8) return '，与班级平均持平';
      return '，低于班级平均水平';
    }

    function rateComment(rate) {
      if (rate === null) return '';
      if (rate >= 0.8) return '表现良好';
      if (rate >= 0.6) return '有提升空间';
      return '需要重点关注';
    }

    var latestMap = getLatestKnowledgeMap();
    var weakKps = Object.keys(latestMap)
      .map(function (k) {
        return latestMap[k];
      })
      .filter(function (d) {
        return d.is_mastered === '未掌握';
      });

    var html = '';

    html +=
      '<div class="ai-section"><div class="ai-section-title">' +
      escapeHtml(studentInfo.student_name) +
      ' 同学学情分析</div></div>';

    html +=
      '<div class="ai-section"><div class="ai-section-title">整体评价</div><div class="ai-text">' +
      '该生本周期学习 <span class="highlight">' +
      activeDays +
      '</span> 天（占比 ' +
      activePercent +
      '%）。查看资料 <span class="highlight">' +
      materialCount +
      '</span> 次，观看视频 <span class="highlight">' +
      videoCount +
      '</span> 次，刷卷 <span class="highlight">' +
      examCount +
      '</span> 次' +
      compareText(examCount, classAvgExamCount) +
      '，练习 <span class="highlight">' +
      practiceCount +
      '</span> 次' +
      compareText(practiceCount, classAvgPracticeCount) +
      '。' +
      '</div></div>';

    html +=
      '<div class="ai-section"><div class="ai-section-title">做题情况</div><div class="ai-text">';
    if (examCount > 0) {
      html +=
        '刷卷 <span class="highlight">' +
        examCount +
        '</span> 次，正确率 <span class="highlight" style="color:' +
        getRateColor(examRate) +
        '">' +
        (examRate * 100).toFixed(1) +
        '%</span>。' +
        rateComment(examRate) +
        '。<br/>';
    } else {
      html += '本周期未进行在线刷卷。<br/>';
    }
    if (practiceCount > 0) {
      html +=
        '练习 <span class="highlight">' +
        practiceCount +
        '</span> 次，正确率 <span class="highlight" style="color:' +
        getRateColor(practiceRate) +
        '">' +
        (practiceRate * 100).toFixed(1) +
        '%</span>。' +
        rateComment(practiceRate) +
        '。';
    } else {
      html += '本周期未进行在线练习。';
    }
    html += '</div></div>';

    if (weakKps.length > 0) {
      html +=
        '<div class="ai-section"><div class="ai-section-title">薄弱知识点（' +
        weakKps.length +
        ' 个未掌握）</div><ul class="ai-text">';
      weakKps.slice(0, 5).forEach(function (k) {
        var kp = k.knowledge_point || k['知识点'] || '';
        html +=
          '<li><span class="highlight ai-warning">' +
          escapeHtml(kp) +
          '</span>（' +
          escapeHtml(pickSubject(k) || '') +
          '）</li>';
      });
      html += '</ul></div>';
    }

    html +=
      '<div class="ai-section"><div class="ai-section-title">学习建议</div><ol class="ai-text ai-suggestion">';
    if (weakKps.length > 0) {
      html +=
        '<li>建议重点复习「' +
        escapeHtml(weakKps[0].knowledge_point || weakKps[0]['知识点']) +
        '」</li>';
    }
    if (weakKps.length > 1) {
      html +=
        '<li>建议针对「' +
        escapeHtml(weakKps[1].knowledge_point || weakKps[1]['知识点']) +
        '」进行专项练习</li>';
    }
    if (examCount === 0 && practiceCount > 0) {
      html += '<li>建议尝试完整试卷练习，检验综合能力</li>';
    }
    if (practiceCount === 0 && examCount > 0) {
      html += '<li>建议针对薄弱知识点进行专项练习</li>';
    }
    if (activeDays < totalDays * 0.3) {
      html += '<li>学习天数较少，建议增加使用频率</li>';
    }
    if (weakKps.length === 0 && examCount > 0) {
      html += '<li>继续保持良好的学习习惯</li>';
    }
    html += '</ol></div>';

    document.getElementById('aiAnalysis').innerHTML = html;
  }

  /* ===== 模块6：生成报告 ===== */
  function buildSubjectReportRows() {
    var subjectMap = {};
    studentExams.forEach(function (d) {
      var sub = pickSubject(d);
      if (!sub) return;
      if (!subjectMap[sub]) {
        subjectMap[sub] = { exams: [], practices: [] };
      }
      subjectMap[sub].exams.push(d);
    });
    studentPractices.forEach(function (d) {
      var sub = pickSubject(d);
      if (!sub) return;
      if (!subjectMap[sub]) {
        subjectMap[sub] = { exams: [], practices: [] };
      }
      subjectMap[sub].practices.push(d);
    });

    return Object.keys(subjectMap)
      .map(function (name) {
        var s = subjectMap[name];
        var allDo = s.exams.concat(s.practices);
        var rate = calcCorrectRate(allDo);
        return {
          name: name,
          examCount: s.exams.length,
          practiceCount: s.practices.length,
          rate: rate
        };
      })
      .sort(function (a, b) {
        return b.examCount + b.practiceCount - (a.examCount + a.practiceCount);
      });
  }

  function generateStudentReport() {
    var activeDays = calcActiveDaysForUser(
      studentDailyActive,
      studentId,
      DATA_PERIOD_START,
      cutoffDate
    );
    var totalDays = getCutoffTotalDays(cutoffDate);
    var examCount = studentExams.length;
    var examRate = calcCorrectRate(studentExams);
    var practiceCount = studentPractices.length;
    var practiceRate = calcCorrectRate(studentPractices);

    var subjectRows = buildSubjectReportRows();
    var latestMap = getLatestKnowledgeMap();
    var kpList = Object.keys(latestMap).map(function (k) {
      return latestMap[k];
    });
    var weakKps = kpList.filter(function (d) {
      return d.is_mastered === '未掌握';
    });

    var subjectTableHtml = '';
    if (subjectRows.length === 0) {
      subjectTableHtml = '<p>暂无各学科做题数据。</p>';
    } else {
      subjectTableHtml =
        '<table><thead><tr><th>学科</th><th>刷卷次数</th><th>练习次数</th><th>正确率</th></tr></thead><tbody>';
      subjectRows.forEach(function (row) {
        subjectTableHtml +=
          '<tr><td>' +
          escapeHtml(row.name) +
          '</td><td>' +
          row.examCount +
          '</td><td>' +
          row.practiceCount +
          '</td><td>' +
          (row.rate !== null ? (row.rate * 100).toFixed(1) + '%' : '--') +
          '</td></tr>';
      });
      subjectTableHtml += '</tbody></table>';
    }

    var weakListHtml = '';
    if (weakKps.length > 0) {
      weakListHtml = '<ul>';
      weakKps.slice(0, 10).forEach(function (k) {
        weakListHtml +=
          '<li>' +
          escapeHtml(k.knowledge_point || k['知识点']) +
          '（' +
          escapeHtml(pickSubject(k) || '') +
          '）</li>';
      });
      weakListHtml += '</ul>';
    } else {
      weakListHtml = '<p>暂无未掌握知识点记录。</p>';
    }

    var reportHtml =
      '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
      '<title>学情报告 - ' +
      escapeHtml(studentInfo.student_name) +
      '</title>' +
      '<style>' +
      'body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;padding:40px;font-size:14px;line-height:1.8;color:#1F2937;max-width:800px;margin:0 auto}' +
      'h2{color:#8B1A1A;text-align:center}' +
      'h3{color:#8B1A1A;border-left:4px solid #8B1A1A;padding-left:12px;margin-top:24px}' +
      '.info{text-align:center;color:#6B7280;margin-bottom:24px}' +
      '.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:16px 0}' +
      '.metric{text-align:center;padding:12px;background:#F7F8FA;border-radius:8px}' +
      '.metric-val{font-size:24px;font-weight:700;color:#8B1A1A}' +
      '.metric-lbl{font-size:12px;color:#6B7280}' +
      'table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}' +
      'th,td{padding:8px;border:1px solid #ddd;text-align:left}' +
      'th{background:#f5f5f5}' +
      'strong{color:#8B1A1A}' +
      '@media print{body{padding:20px}}' +
      '</style></head><body>' +
      '<h2>学生学情分析报告</h2>' +
      '<div class="info">' +
      '<p>' +
      escapeHtml(studentInfo.school_name) +
      ' | ' +
      escapeHtml(studentInfo.grade + ' ' + studentInfo.class_name) +
      ' | ' +
      escapeHtml(studentInfo.student_name) +
      '</p>' +
      '<p>数据截止：' +
      escapeHtml(cutoffDate) +
      ' | 生成时间：' +
      new Date().toLocaleString() +
      '</p></div>' +
      '<h3>一、学习概况</h3>' +
      '<div class="metrics">' +
      '<div class="metric"><div class="metric-val">' +
      activeDays +
      '天</div><div class="metric-lbl">学习天数</div></div>' +
      '<div class="metric"><div class="metric-val">' +
      examCount +
      '次</div><div class="metric-lbl">刷卷次数</div></div>' +
      '<div class="metric"><div class="metric-val">' +
      (examRate !== null ? (examRate * 100).toFixed(1) + '%' : '--') +
      '</div><div class="metric-lbl">刷卷正确率</div></div>' +
      '<div class="metric"><div class="metric-val">' +
      practiceCount +
      '次</div><div class="metric-lbl">练习次数</div></div>' +
      '<div class="metric"><div class="metric-val">' +
      (practiceRate !== null ? (practiceRate * 100).toFixed(1) + '%' : '--') +
      '</div><div class="metric-lbl">练习正确率</div></div>' +
      '</div>' +
      '<h3>二、各学科表现</h3>' +
      subjectTableHtml +
      '<h3>三、知识点掌握情况</h3>' +
      '<p>涉及 <strong>' +
      kpList.length +
      '</strong> 个知识点，已掌握 <strong>' +
      (kpList.length - weakKps.length) +
      '</strong> 个，未掌握 <strong>' +
      weakKps.length +
      '</strong> 个。</p>' +
      weakListHtml +
      '<h3>四、学习建议</h3><ol>';

    if (weakKps.length > 0) {
      reportHtml +=
        '<li>建议重点复习「' +
        escapeHtml(weakKps[0].knowledge_point || weakKps[0]['知识点']) +
        '」</li>';
    }
    if (weakKps.length > 1) {
      reportHtml +=
        '<li>建议针对「' +
        escapeHtml(weakKps[1].knowledge_point || weakKps[1]['知识点']) +
        '」进行专项练习</li>';
    }
    if (activeDays < totalDays * 0.3) {
      reportHtml += '<li>学习天数较少，建议增加使用频率</li>';
    }
    reportHtml += '<li>建议持续保持学习习惯，定期检验学习成果</li>';
    reportHtml +=
      '</ol><div style="text-align:center;margin-top:32px;padding-top:16px;border-top:2px solid #eee;color:#9CA3AF;font-size:12px">' +
      '<p>' +
      escapeHtml(AppState.getSchoolDisplayName()) +
      ' · 学情数据看板</p>' +
      '<p>本报告由系统自动生成</p></div></body></html>';

    var win = window.open('', '_blank');
    if (!win) {
      alert('无法打开新窗口，请允许弹出窗口后重试');
      return;
    }
    win.document.write(reportHtml);
    win.document.close();
    setTimeout(function () {
      win.print();
    }, 500);
  }
  window.generateStudentReport = generateStudentReport;
  window.viewStudentQuestion = viewStudentQuestion;
})();
