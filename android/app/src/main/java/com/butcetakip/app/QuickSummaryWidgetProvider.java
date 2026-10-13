package com.butcetakip.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class QuickSummaryWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_OPEN_ADD_EXPENSE = "com.butcetakip.app.ACTION_OPEN_ADD_EXPENSE";
    public static final String WIDGET_PREFS = "ButcemProWidgetData";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_summary);

        SharedPreferences prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        String netBalance = prefs.getString("net_balance", "₺0,00");
        String monthlyExpense = prefs.getString("monthly_expense", "₺0,00");

        views.setTextViewText(R.id.txt_net_balance, netBalance);
        views.setTextViewText(R.id.txt_monthly_expense, monthlyExpense);

        Intent mainIntent = new Intent(context, MainActivity.class);
        mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent mainPendingIntent = PendingIntent.getActivity(
            context,
            0,
            mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, mainPendingIntent);

        Intent addExpenseIntent = new Intent(context, MainActivity.class);
        addExpenseIntent.setAction(ACTION_OPEN_ADD_EXPENSE);
        addExpenseIntent.putExtra("target_screen", "expenses");
        addExpenseIntent.putExtra("open_add_modal", true);
        addExpenseIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent addPendingIntent = PendingIntent.getActivity(
            context,
            1,
            addExpenseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.btn_add_expense, addPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateAllWidgets(Context context, String netBalance, String monthlyExpense) {
        SharedPreferences prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        prefs.edit()
            .putString("net_balance", netBalance)
            .putString("monthly_expense", monthlyExpense)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, QuickSummaryWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }
}
