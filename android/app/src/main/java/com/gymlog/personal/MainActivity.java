package com.gymlog.personal;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** 拿不到 insets 时的兜底状态栏高度（dp） */
    private static final int FALLBACK_TOP_DP = 28;
    /** 状态栏下方的额外留白（dp），避免标题紧贴状态栏 */
    private static final int EXTRA_TOP_DP = 8;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            applySafeArea();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // 系统栏显示/隐藏、旋转、分屏变化后重新对齐一次
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            View content = findViewById(android.R.id.content);
            if (content != null) {
                ViewCompat.requestApplyInsets(content);
            }
        }
    }

    /**
     * Android 15（API 35）起，targetSdk 35+ 的应用强制 edge-to-edge：
     * WebView 会绘制到状态栏/导航栏下方，页面标题被状态栏的时间和信号图标盖住。
     *
     * 这里给 Activity 的内容容器（android.R.id.content）加顶部内边距，
     * 内容整体让开状态栏与刘海区域；WebView 背景透明，让出的区域露出
     * 主题的 windowBackground（values / values-night 两个颜色）。
     * 相比直接给 WebView 设 padding，改容器更稳，不会被 WebView 自身的布局覆盖。
     */
    private void applySafeArea() {
        final View content = findViewById(android.R.id.content);
        if (content == null) return;

        getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);

        final float density = content.getResources().getDisplayMetrics().density;
        final int fallback = Math.round(FALLBACK_TOP_DP * density);
        final int extra = Math.round(EXTRA_TOP_DP * density);

        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            int top = Math.max(bars.top, fallback) + extra;
            view.setPadding(bars.left, top, bars.right, 0);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(content);
    }
}
