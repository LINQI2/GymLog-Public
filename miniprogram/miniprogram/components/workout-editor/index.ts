import {
  addExerciseToSession,
  addSet,
  createExercise,
  deleteEntry,
  deleteSet,
  findEntry,
  getLastInputs,
  getSession,
  getSettings,
  listExercises,
  listSessions,
  renameEntry,
  replaceEntryExercise,
  setSessionNote,
  touchExercise,
  updateSet,
} from '../../utils/store';
import {
  applyTemplateToDate,
  getTemplate,
  listTemplates,
  substitutionTargets,
} from '../../utils/knowledge';
import { addDays, clockLabel, humanDate, isISODate, nowISO, relativeDayLabel, todayISO } from '../../utils/date';
import { num, restGapLabel, sessionStats, setsSummary, volumeLabel } from '../../utils/format';
import { CATEGORIES, type ExerciseCatalogItem, type WorkoutSession } from '../../utils/types';
import { NAME_MAX, parseReps, parseWeight } from '../../utils/validation';
import { start as startRest } from '../../utils/rest-timer';

type SortMode = 'manual' | 'time';

interface ViewSet {
  id: string;
  index: number;
  weightText: string;
  weightInput: string;
  reps: number;
  volumeText: string;
  gapText: string;
  isWarmup: boolean;
  completedText: string;
}

interface ViewEntry {
  id: string;
  name: string;
  targetText: string;
  lastText: string;
  sets: ViewSet[];
  setCount: number;
  totalReps: number;
}

function findLastEntry(
  sessions: WorkoutSession[],
  date: string,
  ref: { exerciseId?: string; name: string },
): { date: string; sets: any[] } | null {
  for (const session of sessions) {
    if (session.date >= date) continue;
    const entry = session.exercises.find(
      (item) =>
        (ref.exerciseId && item.exerciseId === ref.exerciseId) || item.name === ref.name,
    );
    if (entry && entry.sets.length > 0) return { date: session.date, sets: entry.sets };
  }
  return null;
}

Component({
  properties: {
    /** 训练日期，YYYY-MM-DD；留空表示今天 */
    date: {
      type: String,
      value: '',
    },
    /** 历史详情页为 true：隐藏前后切换 */
    fixedDate: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    currentDate: '',
    dateLabel: '',
    relativeLabel: '',
    startLabel: '',
    fixedDateView: false,
    entries: [] as ViewEntry[],
    stats: { exerciseCount: 0, setCount: 0, volumeText: '—', reps: 0 },
    expandedSetId: '',
    pickerOpen: false,
    pickerKeyword: '',
    pickerCategory: 'all',
    categories: CATEGORIES,
    pickerList: [] as Array<ExerciseCatalogItem & { used: boolean }>,
    newExerciseName: '',
    newExerciseCategory: '其他',
    detailOpen: false,
    detailEntry: null as any,
    planOpen: false,
    planList: [] as any[],
    note: '',
    noteOpen: false,
    noteDraft: '',
  },

  observers: {
    date(value: string) {
      if (!value || value === this.data.currentDate) return;
      this.setData({ currentDate: value, expandedSetId: '' }, () => this.refresh());
    },
  },

  lifetimes: {
    attached() {
      const initial = this.properties.date && isISODate(this.properties.date)
        ? this.properties.date
        : todayISO();
      this.setData({ currentDate: initial }, () => this.refresh());
    },
  },

  pageLifetimes: {
    show() {
      this.refresh();
    },
  },

  methods: {
    /* ==================== 数据刷新 ==================== */

    refresh() {
      const date = this.data.currentDate || todayISO();
      const session = getSession(date);
      const sessions = listSessions();
      const settings = getSettings();

      const entries: ViewEntry[] = (session ? session.exercises.slice() : [])
        .sort((a, b) => a.order - b.order)
        .map((entry) => {
          const last = findLastEntry(sessions, date, entry);
          const targetText = entry.target
            ? `目标 ${entry.target.sets} 组 × ${
                entry.target.repMin === entry.target.repMax
                  ? entry.target.repMin
                  : `${entry.target.repMin}-${entry.target.repMax}`
              } 次`
            : '';
          const sets: ViewSet[] = entry.sets.map((set, index) => {
            const previous = index > 0 ? entry.sets[index - 1] : null;
            return {
              id: set.id,
              index: index + 1,
              weightText: set.weightKg === 0 ? '自重' : `${num(set.weightKg)} kg`,
              weightInput: num(set.weightKg),
              reps: set.reps,
              volumeText: set.weightKg > 0 ? `${Math.round(set.weightKg * set.reps)} kg` : '—',
              gapText: restGapLabel(set.completedAt, previous && previous.completedAt) || '',
              isWarmup: set.type === 'warmup',
              completedText: this.formatCompleted(set.completedAt),
            };
          });
          return {
            id: entry.id,
            name: entry.name,
            targetText,
            lastText: last
              ? `上次 ${humanDate(last.date)}：${setsSummary(last.sets)}`
              : '首次记录这个动作',
            sets,
            setCount: sets.length,
            totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
          };
        });

      const stats = sessionStats(session);
      const startedAt = session ? session.startedAt || session.createdAt : '';
      const sortMode: SortMode = session && session.sortMode === 'time' ? 'time' : 'manual';

      this.setData({
        note: session && session.note ? session.note : '',
        dateLabel: humanDate(date),
        relativeLabel: relativeDayLabel(date) || '',
        startLabel: clockLabel(startedAt) || '',
        entries,
        stats: {
          exerciseCount: stats.exerciseCount,
          setCount: stats.setCount,
          volumeText: volumeLabel(stats.volume),
          reps: stats.reps,
        },
        settingsSnapshot: settings,
        sortMode,
      });

      if (this.data.pickerOpen) this.buildPickerList();
    },

    formatCompleted(iso?: string) {
      if (!iso) return '';
      const date = new Date(iso);
      if (isNaN(date.getTime())) return '';
      const pad = (v: number) => `${v}`.padStart(2, '0');
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    },

    /* ==================== 日期切换 ==================== */

    onPrevDay() {
      this.changeDate(addDays(this.data.currentDate, -1));
    },

    onNextDay() {
      this.changeDate(addDays(this.data.currentDate, 1));
    },

    onPickDate(e: any) {
      const value = e.detail.value;
      if (isISODate(value)) this.changeDate(value);
    },

    changeDate(date: string) {
      this.setData({ currentDate: date, expandedSetId: '', pickerOpen: false }, () =>
        this.refresh(),
      );
    },

    /* ==================== 动作库选择 ==================== */

    openPicker() {
      this.setData(
        {
          pickerOpen: true,
          pickerKeyword: '',
          pickerCategory: 'all',
          newExerciseName: '',
          newExerciseCategory: '其他',
        },
        () => this.buildPickerList(),
      );
    },

    closePicker() {
      this.setData({ pickerOpen: false });
    },

    buildPickerList() {
      const session = getSession(this.data.currentDate);
      const usedIds = new Set<string>();
      const usedNames = new Set<string>();
      (session ? session.exercises : []).forEach((entry) => {
        usedNames.add(entry.name);
        if (entry.exerciseId) usedIds.add(entry.exerciseId);
      });

      const keyword = this.data.pickerKeyword.trim().toLowerCase();
      const category = this.data.pickerCategory;
      const list = listExercises()
        .filter((item) => {
          if (category !== 'all' && item.category !== category) return false;
          if (keyword && item.name.toLowerCase().indexOf(keyword) < 0) return false;
          return true;
        })
        .map((item) => ({
          ...item,
          used: usedIds.has(item.id) || usedNames.has(item.name),
        }));

      this.setData({ pickerList: list });
    },

    onPickerSearch(e: any) {
      this.setData({ pickerKeyword: e.detail.value }, () => this.buildPickerList());
    },

    onPickerCategory(e: any) {
      this.setData({ pickerCategory: e.currentTarget.dataset.category }, () =>
        this.buildPickerList(),
      );
    },

    pickExercise(e: any) {
      const { id, name } = e.currentTarget.dataset;
      const result = addExerciseToSession(this.data.currentDate, { exerciseId: id, name });
      this.setData({ pickerOpen: false }, () => this.refresh());
      if (result.existed) {
        wx.showToast({ title: '这个动作今天已经添加过了', icon: 'none' });
      }
    },

    onNewExerciseName(e: any) {
      this.setData({ newExerciseName: e.detail.value });
    },

    onNewExerciseCategory(e: any) {
      this.setData({ newExerciseCategory: e.currentTarget.dataset.category });
    },

    createNewExercise() {
      const name = this.data.newExerciseName.trim();
      if (!name) {
        wx.showToast({ title: '请输入动作名称', icon: 'none' });
        return;
      }
      if (name.length > NAME_MAX) {
        wx.showToast({ title: `名称最多 ${NAME_MAX} 个字`, icon: 'none' });
        return;
      }
      try {
        const item = createExercise(name, this.data.newExerciseCategory);
        addExerciseToSession(this.data.currentDate, { exerciseId: item.id, name: item.name });
        this.setData({ pickerOpen: false, newExerciseName: '' }, () => this.refresh());
        wx.showToast({ title: '已添加', icon: 'none' });
      } catch (error) {
        wx.showToast({ title: (error as Error).message || '创建失败', icon: 'none' });
      }
    },

    /* ==================== 组操作 ==================== */

    onAddSet(e: any) {
      const entryId = e.currentTarget.dataset.entry;
      const setId = addSet(this.data.currentDate, entryId);
      if (!setId) {
        wx.showToast({ title: '这一组数据不合法', icon: 'none' });
        return;
      }
      const settings = getSettings();
      if (settings.restAutoStart) startRest();
      this.setData({ expandedSetId: setId }, () => this.refresh());
      wx.showToast({ title: '已记录一组', icon: 'none' });
    },

    onToggleSet(e: any) {
      const setId = e.currentTarget.dataset.set;
      this.setData({ expandedSetId: this.data.expandedSetId === setId ? '' : setId });
    },

    onWeightBlur(e: any) {
      const { entry, set } = e.currentTarget.dataset;
      const parsed = parseWeight(e.detail.value);
      if (!parsed.ok) {
        wx.showToast({ title: parsed.error || '重量无效', icon: 'none' });
        this.refresh();
        return;
      }
      updateSet(this.data.currentDate, entry, set, { weightKg: parsed.value });
      this.refresh();
    },

    onRepsBlur(e: any) {
      const { entry, set } = e.currentTarget.dataset;
      const parsed = parseReps(e.detail.value);
      if (!parsed.ok) {
        wx.showToast({ title: parsed.error || '次数无效', icon: 'none' });
        this.refresh();
        return;
      }
      updateSet(this.data.currentDate, entry, set, { reps: parsed.value });
      this.refresh();
    },

    stepWeight(e: any) {
      const { entry, set, delta } = e.currentTarget.dataset;
      const target = this.findSet(entry, set);
      if (!target) return;
      const next = Math.max(0, Math.round((target.weightKg + Number(delta)) * 100) / 100);
      updateSet(this.data.currentDate, entry, set, { weightKg: next });
      this.refresh();
    },

    stepReps(e: any) {
      const { entry, set, delta } = e.currentTarget.dataset;
      const target = this.findSet(entry, set);
      if (!target) return;
      const next = Math.max(1, target.reps + Number(delta));
      updateSet(this.data.currentDate, entry, set, { reps: next });
      this.refresh();
    },

    findSet(entryId: string, setId: string) {
      const entry = findEntry(this.data.currentDate, entryId);
      if (!entry) return null;
      return entry.sets.find((item) => item.id === setId) || null;
    },

    toggleWarmup(e: any) {
      const { entry, set } = e.currentTarget.dataset;
      const target = this.findSet(entry, set);
      if (!target) return;
      updateSet(this.data.currentDate, entry, set, {
        type: target.type === 'warmup' ? 'normal' : 'warmup',
      });
      this.refresh();
    },

    onDeleteSet(e: any) {
      const { entry, set } = e.currentTarget.dataset;
      wx.showModal({
        title: '删除这一组？',
        content: '只会删除这一组的重量和次数记录。',
        confirmText: '删除',
        confirmColor: '#d64545',
        success: (res: any) => {
          if (!res.confirm) return;
          deleteSet(this.data.currentDate, entry, set);
          this.setData({ expandedSetId: '' }, () => this.refresh());
        },
      });
    },

    /* ==================== 动作卡片菜单 ==================== */

    onEntryMenu(e: any) {
      const entryId = e.currentTarget.dataset.entry;
      const entry = findEntry(this.data.currentDate, entryId);
      if (!entry) return;
      wx.showActionSheet({
        itemList: ['训练详情（时间）', '动作资料', '找替代动作', '重命名（仅当天）', '删除动作'],
        success: (res: any) => {
          if (res.tapIndex === 0) {
            this.setData({ detailOpen: true, detailEntry: entry });
          }
          if (res.tapIndex === 1) this.openInfo(entry);
          if (res.tapIndex === 2) this.findSubstitute(entry);
          if (res.tapIndex === 3) this.renameEntry(entryId, entry.name);
          if (res.tapIndex === 4) this.confirmDeleteEntry(entryId, entry.name);
        },
      });
    },

    /* ==================== 当日备注 ==================== */

    openNote() {
      this.setData({ noteOpen: true, noteDraft: this.data.note });
    },

    closeNote() {
      this.setData({ noteOpen: false });
    },

    onNoteInput(e: any) {
      this.setData({ noteDraft: e.detail.value });
    },

    saveNote() {
      setSessionNote(this.data.currentDate, this.data.noteDraft);
      this.setData({ noteOpen: false }, () => this.refresh());
      wx.showToast({ title: '备注已保存', icon: 'none' });
    },

    /* ==================== 训练方案 → 当天 ==================== */

    openPlan() {
      const planList = listTemplates().map((item) => ({
        id: item.id,
        name: item.name,
        subText: `${item.targetMuscles || '未填写目标肌群'} · ${item.exercises.length} 个动作`,
        preview: item.exercises.map((exercise) => exercise.name).join(' · '),
        isFavorite: item.isFavorite,
      }));
      this.setData({ planOpen: true, planList });
    },

    closePlan() {
      this.setData({ planOpen: false });
    },

    pickPlan(e: any) {
      const id = e.currentTarget.dataset.id;
      const template = getTemplate(id);
      if (!template) return;
      if (!template.exercises.length) {
        wx.showToast({ title: '这个方案还没有动作', icon: 'none' });
        return;
      }
      wx.showModal({
        title: `添加「${template.name}」`,
        content: `把 ${template.exercises.length} 个动作加到这一天？只创建动作卡片，不生成已完成的组；当天已有的同名动作会跳过。`,
        confirmText: '添加',
        success: (res: any) => {
          if (!res.confirm) return;
          const ids = template.exercises.map((item) => item.id);
          const result = applyTemplateToDate(this.data.currentDate, template, ids);
          this.setData({ planOpen: false }, () => this.refresh());
          wx.showToast({
            title: result.skipped
              ? `已添加 ${result.added} 个，跳过 ${result.skipped} 个`
              : `已添加 ${result.added} 个动作`,
            icon: 'none',
          });
        },
      });
    },

    openInfo(entry: any) {
      const exerciseId =
        entry.exerciseId || (listExercises().find((item) => item.name === entry.name) || {}).id;
      const name = encodeURIComponent(entry.name);
      wx.navigateTo({
        url: exerciseId
          ? `/pages/exercise-info/index?id=${exerciseId}&name=${name}`
          : `/pages/exercise-info/index?name=${name}`,
      });
    },

    closeDetail() {
      this.setData({ detailOpen: false });
    },

    /** 器械被占用 / 动作不适合时：按替代建议替换或追加，绝不改写已完成组 */
    findSubstitute(entry: any) {
      const exerciseId =
        entry.exerciseId || (listExercises().find((item) => item.name === entry.name) || {}).id;
      if (!exerciseId) {
        wx.showModal({
          title: '没有替代建议',
          content: '动作库里没有这个动作，暂时无法匹配替代动作。',
          showCancel: false,
        });
        return;
      }
      const targets = substitutionTargets(exerciseId);
      if (!targets.length) {
        wx.showModal({
          title: '还没有替代建议',
          content: '可以到「动作资料」里给这个动作添加替代动作，全部保存在本机。',
          confirmText: '去添加',
          success: (res: any) => {
            if (res.confirm) {
              wx.navigateTo({
                url: `/pages/exercise-info/index?id=${exerciseId}&addSub=1`,
              });
            }
          },
        });
        return;
      }

      const hasSets = entry.sets.length > 0;
      wx.showActionSheet({
        itemList: targets.map(
          (item) =>
            `${item.target.name}（${item.substitution.similarity === 'close' ? '较接近' : '部分替代'}）`,
        ),
        success: (res: any) => {
          const chosen = targets[res.tapIndex];
          if (!chosen) return;
          wx.showModal({
            title: hasSets ? '已有完成组' : `替换为「${chosen.target.name}」`,
            content: hasSets
              ? `区别：${chosen.substitution.difference}\n\n这个动作已经记录过组，为避免影响数据，会保留原动作并添加替代动作。`
              : `区别：${chosen.substitution.difference}`,
            confirmText: hasSets ? '添加' : '替换',
            success: (modal: any) => {
              if (!modal.confirm) return;
              if (hasSets) {
                addExerciseToSession(this.data.currentDate, {
                  exerciseId: chosen.target.id,
                  name: chosen.target.name,
                });
                this.refresh();
                wx.showToast({ title: `已添加「${chosen.target.name}」`, icon: 'none' });
                return;
              }
              const replaced = replaceEntryExercise(this.data.currentDate, entry.id, {
                exerciseId: chosen.target.id,
                name: chosen.target.name,
              });
              this.refresh();
              wx.showToast({
                title: replaced ? `已替换为「${chosen.target.name}」` : '替换失败',
                icon: 'none',
              });
            },
          });
        },
      });
    },

    renameEntry(entryId: string, current: string) {
      wx.showModal({
        title: '重命名（仅影响当天记录）',
        editable: true,
        content: current,
        placeholderText: '输入新的动作名称',
        success: (res: any) => {
          if (!res.confirm) return;
          const name = (res.content || '').trim();
          if (!name) {
            wx.showToast({ title: '名称不能为空', icon: 'none' });
            return;
          }
          renameEntry(this.data.currentDate, entryId, name);
          this.refresh();
        },
      });
    },

    confirmDeleteEntry(entryId: string, name: string) {
      wx.showModal({
        title: `删除「${name}」？`,
        content: '会删除当天这个动作及其所有组，动作库不受影响。',
        confirmText: '删除',
        confirmColor: '#d64545',
        success: (res: any) => {
          if (!res.confirm) return;
          deleteEntry(this.data.currentDate, entryId);
          this.setData({ expandedSetId: '' }, () => this.refresh());
        },
      });
    },

    /* 供页面调用：切到今天 */
    goToday() {
      this.changeDate(todayISO());
    },

    noop() {},
    touchRecent(e: any) {
      touchExercise(e.currentTarget.dataset.id);
    },
  },
});
