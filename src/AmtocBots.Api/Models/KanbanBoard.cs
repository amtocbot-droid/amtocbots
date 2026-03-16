namespace AmtocBots.Api.Models;

public sealed class KanbanBoard
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<KanbanColumn> Columns { get; set; } = [];
}

public sealed class KanbanColumn
{
    public Guid Id { get; set; }
    public Guid BoardId { get; set; }
    public KanbanBoard? Board { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Position { get; set; }
    public string? Color { get; set; }
    public int? WipLimit { get; set; }

    public ICollection<KanbanCard> Cards { get; set; } = [];
}

public sealed class KanbanCard
{
    public Guid Id { get; set; }
    public Guid ColumnId { get; set; }
    public KanbanColumn? Column { get; set; }
    public Guid BoardId { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Priority { get; set; } // low | medium | high | critical
    public string[] Labels { get; set; } = [];
    public DateTimeOffset? DueDate { get; set; }
    public int Position { get; set; }

    public Guid? AssignedInstanceId { get; set; }
    public BotInstance? AssignedInstance { get; set; }
    public Guid? AssignedUserId { get; set; }

    /// <summary>human | bot</summary>
    public string CreatedByType { get; set; } = "human";
    public Guid CreatedById { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
