from enum import StrEnum


class ApplicationStatus(StrEnum):
    """Статусы заявки. Диаграмма переходов — docs/state-diagram.md."""

    DRAFT = "DRAFT"                      # клиент заполняет заявку
    SUBMITTED = "SUBMITTED"              # заявка отправлена в банк
    VALIDATION = "VALIDATION"            # проверка полноты и корректности
    INFO_REQUESTED = "INFO_REQUESTED"    # банк запросил уточнения у клиента
    ENRICHMENT = "ENRICHMENT"            # обогащение из БКИ / ЕГРЮЛ / ФНС
    SCORING = "SCORING"                  # расчёт скоринговой оценки
    UNDERWRITING = "UNDERWRITING"        # ручной разбор андеррайтером
    APPROVED = "APPROVED"                # одобрено на запрошенных условиях
    COUNTER_OFFER = "COUNTER_OFFER"      # одобрено на иных условиях
    REJECTED = "REJECTED"                # отказ
    SIGNING = "SIGNING"                  # подписание документов (симуляция)
    ISSUED = "ISSUED"                    # средства выданы (симуляция)
    CANCELLED = "CANCELLED"              # отозвана клиентом
