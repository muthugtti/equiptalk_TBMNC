import React from 'react';

export const markdownComponents = {
    p: ({ ...props }: React.ComponentProps<'p'>) => <p className="mb-2 last:mb-0" {...props} />,
    ul: ({ ...props }: React.ComponentProps<'ul'>) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
    ol: ({ ...props }: React.ComponentProps<'ol'>) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
    li: ({ ...props }: React.ComponentProps<'li'>) => <li {...props} />,
    h1: ({ ...props }: React.ComponentProps<'h1'>) => <h1 className="text-base font-bold mb-2 mt-1" {...props} />,
    h2: ({ ...props }: React.ComponentProps<'h2'>) => <h2 className="text-base font-bold mb-2 mt-1" {...props} />,
    h3: ({ ...props }: React.ComponentProps<'h3'>) => <h3 className="text-sm font-bold mb-1 mt-1" {...props} />,
    strong: ({ ...props }: React.ComponentProps<'strong'>) => <strong className="font-semibold" {...props} />,
    a: ({ ...props }: React.ComponentProps<'a'>) => (
        <a className="text-blue-600 dark:text-blue-400 underline" target="_blank" rel="noopener noreferrer" {...props} />
    ),
    code: ({ ...props }: React.ComponentProps<'code'>) => (
        <code className="bg-gray-100 dark:bg-gray-700 rounded px-1 py-0.5 text-xs font-mono" {...props} />
    ),
    pre: ({ ...props }: React.ComponentProps<'pre'>) => (
        <pre className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 overflow-x-auto text-xs font-mono mb-2" {...props} />
    ),
    table: ({ ...props }: React.ComponentProps<'table'>) => (
        <div className="overflow-x-auto mb-2">
            <table className="border-collapse border border-gray-300 dark:border-gray-600 text-xs" {...props} />
        </div>
    ),
    th: ({ ...props }: React.ComponentProps<'th'>) => (
        <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-100 dark:bg-gray-700 font-semibold text-left" {...props} />
    ),
    td: ({ ...props }: React.ComponentProps<'td'>) => (
        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1" {...props} />
    ),
    blockquote: ({ ...props }: React.ComponentProps<'blockquote'>) => (
        <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-400 mb-2" {...props} />
    ),
    hr: ({ ...props }: React.ComponentProps<'hr'>) => (
        <hr className="border-0 border-t border-gray-200 dark:border-gray-600 my-3" {...props} />
    ),
};
