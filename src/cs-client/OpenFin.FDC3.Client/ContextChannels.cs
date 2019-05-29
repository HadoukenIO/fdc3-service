using OpenFin.FDC3.Channels;
using System;
using System.Threading.Tasks;

namespace OpenFin.FDC3
{
    public sealed class ContextChannels
    {
        private static readonly ContextChannels _instance = new ContextChannels();

        private ContextChannels() { }

        public static ContextChannels Instance => _instance;        
       
        /// <summary>
        /// Adds handler to respond to events when a window changes from one channel to another
        /// </summary>
        /// <param name="handler">The handler</param>
        public void AddChannelChangedEventListener(Action<ChannelChangedPayload> handler)
        {
            Connection.AddChannelChangedEventListener(handler);
        }

        /// <summary>
        /// Retrieves all available context channels
        /// </summary>
        /// <returns></returns>
        public Task<Channel[]> GetAllChannelsAsync()
        {
            return Connection.GetAllChannels();
        }

        public Task<Channel> GetChannelAsync(Identity identity = null)
        {
            return Connection.GetChannelAsync(identity);
        }

        public Task<Identity[]> GetChannelMembersAsync(string channelId)
        {
            return Connection.GetChannelMembersAsync(channelId);
        }

        public Task JoinChannelAsync(string channelId, Identity identity = null)
        {
            return Connection.JoinChannelAsync(channelId, identity);
        }

        /// <summary>
        /// Removed handler that responds to events when a window changes from cone channel to another
        /// </summary>
        /// <param name="handler">The handler</param>
        public void RemoveChannelChangedEventListener(Action<ChannelChangedPayload> handler)
        {
            Connection.RemoveChannelChangedEventListener(handler);
        }
    }
}