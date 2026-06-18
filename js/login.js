/**
 * 登录页：账号密码校验与跳转
 */

async function handleLogin() {
  var username = document.getElementById('username').value.trim();
  var password = document.getElementById('password').value.trim();

  if (!username) {
    alert('请输入账号');
    return;
  }
  if (!password) {
    alert('请输入密码');
    return;
  }

  var btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = '登录中...';

  try {
    if (typeof ensureSchoolBrands === 'function') {
      await ensureSchoolBrands();
    }
    var accounts = await DataLoader.accounts();

    if (!accounts || accounts.length === 0) {
      alert(
        '未加载到账号数据。请使用 start-local.bat 启动后通过 http:// 访问，不要直接用 file:// 打开。'
      );
      btn.disabled = false;
      btn.textContent = '登 录';
      return;
    }

    var matchedUser = accounts.find(function (account) {
      if (!account || typeof account !== 'object') return false;
      var accountName =
        typeof readAccountField === 'function'
          ? readAccountField(account, '用户名')
          : String(account['用户名'] || account['姓名'] || '')
              .replace(/\uFEFF/g, '')
              .trim();
      var accountPwd =
        typeof readAccountField === 'function'
          ? readAccountField(account, '登录密码')
          : String(account['登录密码'] || '')
              .replace(/\uFEFF/g, '')
              .trim();
      return accountName === username && accountPwd === password;
    });

    if (!matchedUser) {
      alert('账号或密码错误');
      btn.disabled = false;
      btn.textContent = '登 录';
      return;
    }

    var user = {
      role: readAccountField(matchedUser, '用户身份'),
      user_level: readAccountField(matchedUser, '用户分层'),
      name: readAccountField(matchedUser, '用户名'),
      school_name: readAccountField(matchedUser, '学校名称'),
      campus: readAccountField(matchedUser, '所属校区'),
      grade: readAccountField(matchedUser, '年级'),
      manage_class: readAccountField(matchedUser, '管理班级'),
      teach_classes: readAccountField(matchedUser, '授课班级'),
      subject: readAccountField(matchedUser, '学科'),
      class_name: readAccountField(matchedUser, '管理班级'),
    };

    AppState.setUser(user);

    if (typeof syncCurrentUserProfile === 'function') {
      await syncCurrentUserProfile();
    }

    var loggedIn = AppState.getUser() || user;
    if (loggedIn.user_level === '管理层') {
      window.location.href = 'cockpit.html';
    } else {
      window.location.href = 'diagnosis.html';
    }
  } catch (e) {
    console.error('登录失败:', e);
    alert('登录失败，请稍后重试');
    btn.disabled = false;
    btn.textContent = '登 录';
  }
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    handleLogin();
  }
});
