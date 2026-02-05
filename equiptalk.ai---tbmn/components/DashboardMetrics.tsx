
import React from 'react';

export const DashboardMetrics: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark pt-4 pb-2 flex-none z-10 shadow-sm border-b border-transparent dark:border-gray-800">
      <div className="max-w-2xl mx-auto w-full px-4">
        {/* Greeting Section */}
        <div className="text-center space-y-2 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Good Morning, Cathode Operator</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            TBMNC Facility Status: <span className="text-green-500 font-medium">Optimal</span>
          </p>
        </div>

        {/* Live Metrics Section */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Live Metrics</h2>
            <span className="text-xs text-primary font-medium">Updated 1m ago</span>
          </div>
          <div className="relative w-full overflow-hidden">
            <div className="flex space-x-3 overflow-x-auto pb-2 snap-x snap-mandatory pr-4">
              {/* Plan Card */}
              <div className="flex-shrink-0 w-32 p-3 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden snap-center">
                <div className="absolute right-0 top-0 p-2 opacity-10">
                  <span className="material-icons-outlined text-3xl text-gray-400">assignment</span>
                </div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Plan</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">12,000</p>
                <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-gray-400 dark:bg-gray-500 w-full rounded-full"></div>
                </div>
              </div>

              {/* Actual Card */}
              <div className="flex-shrink-0 w-32 p-3 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden snap-center">
                <div className="absolute right-0 top-0 p-2 opacity-10">
                  <span className="material-icons-outlined text-3xl text-blue-500">done_all</span>
                </div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Actual</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">10,587</p>
                <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-blue-500 w-[88%] rounded-full"></div>
                </div>
              </div>

              {/* Variance Card */}
              <div className="flex-shrink-0 w-32 p-3 bg-white dark:bg-surface-dark rounded-xl border border-primary dark:border-primary/50 shadow-sm shadow-primary/10 relative overflow-hidden snap-center">
                <div className="absolute right-0 top-0 p-2 opacity-10">
                  <span className="material-icons-outlined text-3xl text-primary">trending_down</span>
                </div>
                <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">Variance</p>
                <p className="text-xl font-bold text-primary">1,413</p>
                <div className="flex items-center space-x-1 mt-2">
                  <span className="material-icons text-primary text-[10px]">warning</span>
                  <span className="text-[10px] text-primary/80">Below Target</span>
                </div>
              </div>

              {/* Scrap Card */}
              <div className="flex-shrink-0 w-32 p-3 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden snap-center">
                <div className="absolute right-0 top-0 p-2 opacity-10">
                  <span className="material-icons-outlined text-3xl text-orange-500">delete_outline</span>
                </div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Scrap</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">71</p>
                <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-orange-500 w-[15%] rounded-full"></div>
                </div>
              </div>

              {/* OR Card */}
              <div className="flex-shrink-0 w-32 p-3 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden snap-center">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">OR</p>
                  <span className="material-icons-outlined text-yellow-500 text-sm">speed</span>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">75%</p>
                <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-yellow-500 w-[75%] rounded-full"></div>
                </div>
              </div>

               {/* OA Card */}
               <div className="flex-shrink-0 w-32 p-3 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden snap-center">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">OA</p>
                  <span className="material-icons-outlined text-green-500 text-sm">check_circle</span>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">89%</p>
                <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-green-500 w-[89%] rounded-full"></div>
                </div>
              </div>

               {/* Downtime Card */}
               <div className="flex-shrink-0 w-32 p-3 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden snap-center">
                <div className="absolute right-0 top-0 p-2 opacity-10">
                  <span className="material-icons-outlined text-3xl text-red-500">timer_off</span>
                </div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Downtime</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">160 <span className="text-xs font-normal text-gray-500">min</span></p>
                <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-red-500 w-[40%] rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background-light dark:from-background-dark to-transparent pointer-events-none"></div>
          </div>
        </section>
      </div>
    </div>
  );
};
