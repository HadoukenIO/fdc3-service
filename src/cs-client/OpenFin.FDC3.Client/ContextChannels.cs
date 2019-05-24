using OpenFin.FDC3.Channels;
using System;
using System.Threading.Tasks;

namespace OpenFin.FDC3
{
    public class ContextChannels
    {
        /// <summary>
        /// Adds handler to respond to events when a window changes from one channel to another
        /// </summary>
        /// <param name="handler">The handler</param>
        public static void AddChannelChangedEventListener(Action<ChannelChangedPayload> handler)
        {
            Connection.AddChannelChangedEventListener(handler);
        }

        public static Task<Channel[]> GetAllChannelsAsync()
        {
            return Connection.GetAllChannels();
        }

        public static Task<Channel> GetChannelAsync(Identity identity = null)
        {
            return Connection.GetChannelAsync(identity);
        }

        public static Task<Identity[]> GetChannelMembersAsync(string channelId)
        {
            return Connection.GetChannelMembersAsync(channelId);
        }

        public static Task JoinChannelAsync(string channelId, Identity identity = null)
        {
            return Connection.JoinChannelAsync(channelId, identity);
        }

        /// <summary>
        /// Removed handler that responds to events when a window changes from cone channel to another
        /// </summary>
        /// <param name="handler">The handler</param>
        public static void RemoveChannelChangedEventListener(Action<ChannelChangedPayload> handler)
        {
            Connection.RemoveChannelChangedEventListener(handler);
        }
    }
}