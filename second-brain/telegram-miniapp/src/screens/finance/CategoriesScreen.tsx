import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import {
  listFinanceCategorizationRules,
  listFinanceCategories,
} from "../../services/api";
import { Icon } from "./components/Icon";
import {
  EmptyState,
  ErrorState,
  FinancePhone,
  Skeleton,
} from "./components/shell";

export function CategoriesScreen(): ReactNode {
  const categoriesQuery = useQuery({
    queryKey: ["finance", "categories"],
    queryFn: listFinanceCategories,
  });
  const rulesQuery = useQuery({
    queryKey: ["finance", "categorization-rules"],
    queryFn: listFinanceCategorizationRules,
  });

  const categories = categoriesQuery.data ?? [];
  const rules = rulesQuery.data ?? [];
  const isLoading = categoriesQuery.isLoading || rulesQuery.isLoading;
  const hasError =
    categoriesQuery.isError &&
    !categoriesQuery.data &&
    !categoriesQuery.isFetching;

  return (
    <FinancePhone title="Категории" activeTab="more" backTo="/finance/more">
      <div className="red-head">
        <div className="hello">Категории и правила</div>
        <div className="sub">
          Иерархия трат и автокатегоризация по мерчанту
        </div>
      </div>

      <div className="scroll">
        {isLoading && (
          <div className="card">
            <Skeleton width="70%" height={18} />
            <div style={{ height: 12 }} />
            <Skeleton width="100%" height={52} />
          </div>
        )}
        {hasError && <ErrorState message="Не удалось загрузить категории" />}
        {!isLoading && !hasError && categories.length === 0 && (
          <EmptyState
            title="Категорий пока нет"
            description="Предустановленные категории появятся после обновления backend."
          />
        )}
        {categories.map((category) => {
          const children = categories.filter(
            (item) => item.parent_id === category.id,
          );
          if (category.parent_id) return null;
          return (
            <div className="card" key={category.id}>
              <div className="row between">
                <div className="row gap">
                  <div
                    className="ico red-soft"
                    style={{ color: category.color }}
                  >
                    <Icon name="tag" size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{category.name}</div>
                    <div className="tiny mute">
                      {category.type === "income" ? "Доход" : "Расход"}
                      {category.is_preset ? " · preset" : ""}
                    </div>
                  </div>
                </div>
                <div className="tiny mute">{children.length} подкат.</div>
              </div>
              {children.length > 0 && (
                <div className="chips" style={{ marginTop: 12 }}>
                  {children.map((child) => (
                    <span className="chip" key={child.id}>
                      {child.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="card">
          <div className="section-title" style={{ padding: 0, marginBottom: 8 }}>
            <h3>Автокатегоризация</h3>
          </div>
          {rules.length === 0 ? (
            <div className="tiny mute">
              Правила появятся после ручной корректировки категории у мерчанта.
            </div>
          ) : (
            rules.map((rule) => (
              <div className="sub-row" key={rule.id}>
                <div className="ico sm blue-soft">
                  <Icon name="sparkles" size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>
                    {rule.merchant_pattern}
                  </div>
                  <div className="tiny mute">→ {rule.category}</div>
                </div>
                <div className="tiny mute">p{rule.priority}</div>
              </div>
            ))
          )}
        </div>
        <div style={{ height: 16 }} />
      </div>
    </FinancePhone>
  );
}
