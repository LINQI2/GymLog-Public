import { clockLabel, clockLabelSec, durationLabel } from '../../utils/date';
import { num, restGapLabel } from '../../utils/format';

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    entry: {
      type: Object,
      value: null,
    },
  },

  data: {
    name: '',
    startText: '—',
    totalText: '',
    rows: [] as any[],
  },

  observers: {
    'show, entry': function (show: boolean) {
      if (!show) return;
      this.build();
    },
  },

  methods: {
    build() {
      const entry = this.properties.entry;
      if (!entry) return;
      const sets = entry.sets || [];
      const firstIso = entry.startedAt || (sets[0] && sets[0].completedAt) || '';
      let volume = 0;
      let reps = 0;
      sets.forEach((set: any) => {
        reps += set.reps || 0;
        if (set.weightKg > 0) volume += set.weightKg * set.reps;
      });

      const lastIso = sets.length ? sets[sets.length - 1].completedAt : '';

      this.setData({
        name: entry.name,
        startText: clockLabel(firstIso) || '未记录',
        totalText: sets.length
          ? `${sets.length} 组 · ${reps} 次 · ${volume > 0 ? Math.round(volume) + ' kg' : '自重'} · 用时 ${durationLabel(Date.parse(lastIso) - Date.parse(firstIso)) || '不到 1 分钟'}`
          : '还没有记录',
        rows: sets.map((set: any, index: number) => ({
          id: set.id,
          index: index + 1,
          weightText: set.weightKg === 0 ? '自重' : `${num(set.weightKg)} kg`,
          reps: set.reps,
          completedText: clockLabelSec(set.completedAt) || '—',
          gapText:
            restGapLabel(set.completedAt, index > 0 ? sets[index - 1].completedAt : undefined) || '',
          isWarmup: set.type === 'warmup',
        })),
      });
    },

    onClose() {
      this.triggerEvent('close');
    },
  },
});
