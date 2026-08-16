Page({
  data: {
    // userInfo: {},    // 存储用户信息
    userInput: '',
    reply: '',
    descriptionList: [], // 五段插画描述，建议从豆包返回结果中解析
    imageList: [], // 存放五张图地址
    prompt: '',
    // 新增：生成类型选择项
    typeOptions: ['生成图片', '生成视频'],
    typeIndex: 1,  // 默认“生成视频”
    generationType: 'video',  // 可选值：'image' | 'video'
    avatars: [
      { name: '头像1', src: '../../image/maodie1.png' },
      { name: '头像2', src: '../../image/maodie2.png' },
      { name: '头像3', src: '../../image/maodie3.png' },
      { name: '头像4', src: '../../image/maodie4.png' },
      { name: '头像5', src: '../../image/maodie5.png' }

    ],
    currentAvatar: '../../image/maodie.png',  // 默认头像路径

    isEditing: false,  // 是否处于编辑状态
    newNickname: '',  // 存储输入的昵称

  },


  onTypeChange(e) {
    const index = Number(e.detail.value);
    const type = index === 0 ? 'image' : 'video';
    this.setData({
      typeIndex: index,
      generationType: type
    });
  },
  // goToHistory() {
  //   wx.navigateTo({
  //     url: '/page/history/index'
  //   })
  // },

  // 页面加载时获取全局用户信息
  onLoad() {
    const app = getApp();
  
    // ⚠️ 判断是否已登录（有 userInfo 且 openid 不为 guest）
    const userInfo = app.globalData.userInfo;
    
    
    if (!userInfo || userInfo.openid === 'guest') {
      wx.showModal({
        title: '提示',
        content: '请到用户界面登录',
        showCancel: false,
        success(res) {
          if (res.confirm) {
            wx.reLaunch({
              url: '/page/usr/index'
            });
          }
        }
      });
      return; // 阻止后续逻辑执行
    }
  
    // ✅ 初始化云环境
    wx.cloud.init({
      env: 'cloud1-8gmijxcx249b2dbf'
    });
  
    // ✅ 设置本页 userInfo 显示基本头像与昵称
    console.log('userInfo：', userInfo);
    this.setData({
      userInfo: userInfo,
      newNickname: userInfo.nickName || '微信用户',
      
    });
    

    

  
    // ✅ 可选：记录设备信息
    const systemInfo = wx.getSystemInfoSync();
    // this.getAvatarFromCloud();
    console.log('页面宽高：', systemInfo.windowWidth, systemInfo.windowHeight);
  
    // ✅ 从云数据库获取 userProfile 的最新头像和昵称（覆盖本地显示）
    this.getUserProfileFromCloud(); 
  },


  onShow() {
    // 页面每次展示时触发
    this.getUserProfileFromCloud();
  },
  




  onInput(e) {
    this.setData({
      userInput: e.detail.value
    });
  },

  // 清理非法字符（HTML、符号、emoji）
  sanitizeInput(str) {
    return str
      .replace(/<[^>]*>/g, '')                      // 移除HTML标签
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '')  // 只保留中英数字和空格
      .trim();
  },

  validateKeywords(keywords) {
    const invalidPattern = /[<>\/\\'"`@#$%^&*_=+\[\]{}|~]/;
    return keywords.every(word => !invalidPattern.test(word));
  },

  submitToDoubao() {
    const rawInput = this.data.userInput.trim();
    const cleanedInput = this.sanitizeInput(rawInput);
    const { generationType } = this.data;

    const keywords = cleanedInput
      .split(/[\s,，、]+/)
      .filter(k => k.length > 0)
      .slice(0, 5);

    if (keywords.length === 0) {
      wx.showToast({ title: '请至少输入1个关键词', icon: 'none' });
      return;
    }

    if (!this.validateKeywords(keywords)) {
      wx.showToast({ title: '关键字含有非法字符', icon: 'none' });
      return;
    }

    const keywordStr = keywords.map(k => `“${k}”`).join('、');
    const prompt = `请以${keywordStr}为主题写一段童话故事，总共分为5个段落，总字数不超过300字。`;
    this.setData({ prompt }, () => {
      this.generateContentFlow();
    });
    wx.showLoading({ title: '生成中...', mask: true });


  },
  // 内容生成流程
  generateContentFlow() {
    const prompt = this.data.prompt;
    wx.request({
      url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      method: 'POST',
      timeout: 30000,
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer f654b644-c5cf-42ff-aad3-3ee606e04cab'  // ⚠️生产中请勿暴露！
      },
      data: {
        model: 'doubao-1-5-pro-32k-250115',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      success: (res) => {
        wx.hideLoading();
        const story = res.data?.choices?.[0]?.message?.content;
        console.log('豆包童话内容：', story);

        if (typeof story === 'string' && story.trim()) {
          this.setData({ reply: story });
          const paragraphs = story
            .split(/\n{2,}|\r\n\r\n/)
            // .map(p =>
            //   p.trim().replace(
            //     /^(#{1,6}|\-+|—+|[（(]?\d+[）)]?|[①②③④⑤⑥⑦⑧⑨⑩]|第[一二三四五六七八九十百千万]+[章段节]?)\s*/u,
            //     ''
            //   )
            // )
            .filter(p => p.length > 10)
            .slice(0, 5);



          if (paragraphs.length === 0) {
            wx.showToast({ title: '童话分段失败', icon: 'none' });
            return;
          }
          this.setData({ descriptionList: paragraphs });


          if (this.data.generationType === 'image') {
            this.generateIllustrationFlow(); // 自定义图片生成功能
          } else if (this.data.generationType === 'video') {
            this.generateVideoFlow(); // 自定义视频生成功能
          }

        } else {
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      }
      ,
      fail: (err) => {
        wx.hideLoading();
        console.error('请求失败：', err);
        wx.showToast({ title: '请求失败', icon: 'none' });
      }
    });
  },
  // 图片生成流程
  generateIllustrationFlow() {
    wx.showLoading({ title: '生成插画中...' });
    const promises = this.data.descriptionList.map(desc => this.generateImage(desc));
    Promise.all(promises).then(urls => {
      wx.hideLoading();
      console.log('图片数组:', urls);

      this.saveGenerationHistory('image', urls);

      this.setData(
        {
          imageList: urls,
          swiperKey: Date.now() // 添加动态 key 强制重新渲染
          // swiperKey: Date.now() 
        }, () => {
          if (this.data.imageList.length > 0 && !this.data.hasShownDialog) {
            wx.showModal({
              title: '提示',
              content: '图片生成完成，请在历史记录查看',
              showCancel: false
            })
            this.setData({ hasShownDialog: true })
          }
        });


    }).catch(err => {
      wx.hideLoading();
      // wx.showToast({ title: '部分图片生成失败', icon: 'none' });
      wx.showModal({
        title: '提示',
        content: '图片生成失败，请重试',
        showCancel: false
      })
    });
  },

  // 视频生成流程（占位逻辑）
  generateVideoFlow() {
    wx.showLoading({ title: '生成视频中...' });

    const promptText = this.data.descriptionList.join('\n');
    const videoPrompt = `请以童话风格生成。多个镜头。${promptText} --ration 16:9 --resolution 480p --duration 10 --framepersecond 16 --watermark false`;

    wx.request({
      url: 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
      method: 'POST',
      timeout: 30000,
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer f654b644-c5cf-42ff-aad3-3ee606e04cab'
      },
      data: {
        model: 'doubao-seaweed-241128',
        content: [
          {
            type: 'text',
            text: videoPrompt
          }
        ]
      },
      success: (res) => {
        wx.hideLoading();
        const taskId = res.data?.id;
        console.log('视频生成返回原始数据:', res);
        if (taskId) {
          console.log('🎬 视频生成任务提交成功，任务ID:', taskId);
          wx.showToast({ title: '视频生成中，请稍后查看', icon: 'none' });

          // ⭐ 可以把 taskId 存下来，稍后轮询获取视频地址
          this.pollVideoResult(taskId);
        } else {
          wx.showToast({ title: '任务提交失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.log('视频生成返回数据：', err.data);
        wx.hideLoading();
        console.error('视频生成请求失败：', err);
        wx.showToast({ title: '视频生成失败', icon: 'none' });
      }
    });
  },


  generateImage(promptText) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
        method: 'POST',
        timeout: 30000,
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer f654b644-c5cf-42ff-aad3-3ee606e04cab'
        },
        data: {
          model: 'doubao-seedream-3-0-t2i-250415',
          prompt: promptText,
          response_format: 'url',
          size: '768x512',
          guidance_scale: 2.5,
          watermark: false
        },
        success: (res) => {
          console.log('请求成功，返回数据：', res);


          const url = res.data?.data?.[0]?.url;
          url ? resolve(url) : reject('无效URL');
        },
        fail: (err) => {
          console.error('图像生成失败：', err);
          reject(err);
        }
      });
    });
  },
  pollVideoResult(taskId) {
    const checkUrl = `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${taskId}`;
    let retryCount = 0;
    const maxRetries = 40; // 最多轮询40次，大约1分40秒

    const interval = setInterval(() => {
      if (retryCount >= maxRetries) {
        clearInterval(interval);
        wx.hideLoading();
        wx.showToast({ title: '超时未完成', icon: 'none' });
        console.warn('轮询超时');
        return;
      }

      retryCount++;

      wx.request({
        url: checkUrl,
        method: 'GET',
        header: {
          'Authorization': 'Bearer f654b644-c5cf-42ff-aad3-3ee606e04cab'
        },
        success: (res) => {
          console.log(`第${retryCount}次轮询：`, res.data);
          wx.showToast({ title: '视频正在努力生成中，请耐心等待', icon: 'none' });
          const status = res.data?.status;
          if (status === 'succeeded') {
            // wx.showToast({ title: '视频生成成功', icon: 'none' });
            wx.showModal({
              title: '提示',
              content: '视频生成成功，请在历史记录查看',
              showCancel: false
            })
            clearInterval(interval);
            const videoUrl = res.data?.content?.video_url;
            if (videoUrl) {
              this.saveGenerationHistory('video', videoUrl);
              console.log('✅ 视频地址：', videoUrl);
              wx.navigateTo({
                url: `/pages/videoPreview/videoPreview?videoUrl=${encodeURIComponent(videoUrl)}`
              });
            } else {
              wx.showToast({ title: '未获取到视频地址', icon: 'none' });
            }
          } else if (status === 'failed') {
            clearInterval(interval);
            // wx.showToast({ title: '视频生成失败', icon: 'none' });
            wx.showModal({
              title: '提示',
              content: '视频生成失败，请重试',
              showCancel: false
            })
          } else {
            console.log(`⏳ 视频状态：${status}`);
          }
        },
        fail: (err) => {
          clearInterval(interval);
          console.error('视频状态获取失败：', err);
          wx.showToast({ title: '状态获取失败', icon: 'none' });
        }
      });
    }, 5000);
  },
  // 从 userProfile 集合中获取头像和昵称
  getUserProfileFromCloud() {
    const app = getApp();
    const db = wx.cloud.database();
    const userProfileCollection = db.collection('userProfile');
    const openid = app.globalData.userInfo?.openid;
    if (!openid) {
      console.error('缺少 openid，无法获取用户信息');
      return;
    }

    // 查询 userProfile 集合中当前用户的记录
    userProfileCollection.doc(openid).get({
      success: (res) => {
        const data = res.data;
        if (data) {
          // 更新全局数据和本地数据
          const fullUserInfo = {
            ...app.globalData.userInfo,
            nickName: data.nickName || '微信用户',
            avatarUrl: data.avatarUrl || '../../image/maodie.png',
          };

          app.globalData.userInfo = fullUserInfo;
          this.setData({
            userInfo: fullUserInfo,
            newNickname: fullUserInfo.nickName,
            currentAvatar: fullUserInfo.avatarUrl
          });
        } else {
          console.log('未查询到用户信息');
        }
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
      }
    });
  },


  saveGenerationHistory(type, data) {
    const db = wx.cloud.database();
    // 格式化日期为 'YYYY-MM-DD HH:MM:SS' 格式
    const now = new Date()

    const historyRecord = {
      inputText: this.data.userInput || '',
      description: this.data.descriptionList || '',
      createdAt: now,
      isFavor: false,
      type // 'image' 或 'video'
    };

    if (type === 'image') {
      historyRecord.images = data; // 传入的是图片URL数组
    } else if (type === 'video') {
      historyRecord.videoUrl = data; // 传入的是视频URL字符串
    } else {
      console.warn('⚠️ 未知的历史记录类型');
      return;
    }

    db.collection('history').add({
      data: historyRecord,
      success: res => {
        console.log('✅ 历史记录已保存', res);
      },
      fail: err => {
        console.error('❌ 保存历史记录失败 ❌', err);
        wx.showToast({ title: '历史记录保存失败', icon: 'none' });
      }
    });
  },

  // 获取云数据库中的头像信息

  getAvatarFromCloud() {
    const app = getApp();
    wx.getUserProfile({
      desc: '用于展示您的昵称和头像',
      success: res => {
        app.getUserOpenId((err, openid) => {
          if (err) {
            console.error('获取openid失败', err);
            wx.showToast({ title: '登录失败', icon: 'none' });
            return;
          }

          const fullUserInfo = {
            ...res.userInfo,
            openid
          };

          // 更新全局和本地数据
          app.globalData.userInfo = fullUserInfo;
          this.setData({ userInfo: fullUserInfo });

        });
      },
      fail: () => {
        console.log('获取头像失败')
      }
    });
  },

  // 用户点击头像时调用的函数，显示头像选择弹窗
  changeAvatar() {
    this.setData({
      showModal: true,  // 显示头像选择弹窗
    });
  },

  // 用户选择头像时调用的函数
  selectAvatar(event) {
    const selectedAvatar = event.currentTarget.dataset.src;  // 获取选中的头像路径
    this.setData({
      currentAvatar: selectedAvatar,  // 更新当前头像
      showModal: false,  // 关闭弹窗
    });

    // 获取用户ID
    const userId = getApp().globalData.userInfo.openid;

    // 获取云数据库引用
    const db = wx.cloud.database();

    db.collection('userAvatars').doc(userId).set({
      data: {
        avatarUrl: selectedAvatar,
        updatedAt: db.serverDate()
      },
      success: res => {
        console.log('头像已更新:', res);
      },
      fail: err => {
        if (err.errCode === 11) {  // 文档不存在，首次创建
          db.collection('userAvatars').add({
            data: {
              _id: userId,
              avatarUrl: selectedAvatar,
              createdAt: db.serverDate()
            }
          });
        } else {
          console.error('头像更新失败:', err);
        }
      }
    });

  },

  closeModal() {
    this.setData({
      showModal: false,  // 关闭弹窗
    });
  },


  // 点击昵称时触发，显示输入框
  editNickname() {
    this.setData({
      isEditing: true,  // 显示输入框
    });
  },

  // 监听昵称输入框的内容
  onNicknameInput(event) {
    this.setData({
      newNickname: event.detail.value,  // 更新输入的昵称
    });
  },

  // 点击保存按钮保存新的昵称
  saveNickname() {
    const newNickname = this.data.newNickname;
    if (!newNickname) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none',
      });
      return;
    }

    // 更新全局的用户信息
    getApp().globalData.userInfo.nickName = newNickname;
    this.setData({
      'userInfo.nickName': newNickname,  // 更新页面上的昵称
      isEditing: false,  // 关闭编辑框
    });

    // 保存新昵称到云数据库
    this.saveNicknameToCloud(newNickname);
  },

  // 点击取消按钮，关闭编辑框
  cancelEdit() {
    this.setData({
      isEditing: false,  // 关闭编辑框
      newNickname: this.data.userInfo.nickName,  // 恢复原昵称
    });
  },

  // 保存昵称到云数据库
  saveNicknameToCloud(newNickname) {
    const db = wx.cloud.database();
    const userCollection = db.collection('userName');  // 假设云数据库集合名为 'userName'

    // 获取用户ID（这里使用 openid 作为示例）
    const userId = getApp().globalData.userInfo.openid;

    // 更新昵称
    userCollection.add({
      data: {
        userId: userId,  // 用户唯一标识
        userName: newNickname,  // 用户的昵称
        createdAt: db.serverDate(),  // 创建时间
      },
      success(res) {
        console.log('昵称保存成功:', res);
        // 这里可以调用其他操作，更新界面等
      },
      fail(err) {
        console.error('保存昵称失败:', err);
      }
    });
  },

  // 获取云数据库中的头像信息
  getNickNameFromCloud() {
    const db = wx.cloud.database();
    const userAvatars = db.collection('userName');  // 云数据库集合

    // 获取当前用户ID
    const userId = getApp().globalData.userInfo.openid;  // 假设使用 openid 作为用户ID

    // 查询用户头像，按创建时间降序排列，获取最新的头像
    userAvatars.where({ userId: userId })
      .orderBy('createdAt', 'desc')  // 按 createdAt 降序排列
      .limit(1)  // 限制返回1条数据（最新一条记录）
      .get({
        success: (res) => {
          if (res.data.length > 0) {
            // 如果查询到最新的头像数据，更新当前头像
            this.setData({
              'userInfo.nickName': res.data[0].userName,  // 获取最新的头像
            });
          } else {
            console.log('未找到昵称数据');
          }
        },
        fail: (err) => {
          console.error('获取昵称失败', err);
        }
      });
  },








});