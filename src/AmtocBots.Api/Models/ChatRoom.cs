namespace AmtocBots.Api.Models;

public sealed class ChatRoom
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsGlobal { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ChatRoomMember> Members { get; set; } = [];
    public ICollection<ChatMessage> Messages { get; set; } = [];
}

public sealed class ChatRoomMember
{
    public Guid RoomId { get; set; }
    public ChatRoom? Room { get; set; }

    /// <summary>user | bot</summary>
    public string MemberType { get; set; } = "user";
    public Guid MemberId { get; set; }
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class ChatMessage
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public ChatRoom? Room { get; set; }

    /// <summary>user | bot</summary>
    public string SenderType { get; set; } = "user";
    public Guid SenderId { get; set; }

    public string Content { get; set; } = string.Empty;
    public Guid[] Mentions { get; set; } = [];
    public Guid? ReplyToId { get; set; }
    public ChatMessage? ReplyTo { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EditedAt { get; set; }
}
